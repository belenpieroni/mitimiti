const { randomUUID: uuidv4 } = require('crypto');
const { pool } = require('../db');
const { cargarJuntadaCompleta } = require('../helpers/juntadaHelpers');
const { calcularBalance, calcularBalanceGlobal } = require('../services/balanceService');
const { notifyUsersByName, NOTIFICATION_CATEGORIES } = require('../services/pushNotificationService');

const COLORES_DISPONIBLES = [
  '#2E7D32', '#E67E22', '#C62828', '#00897B',
  '#AD1457', '#F9A825', '#1565C0', '#6D4C41',
];

const normalizeId = (value) => String(value || '').trim().toLowerCase();

function getIniciales(nombre) {
  const partes = nombre.trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

// ── Juntadas ──────────────────────────────────────────────────────────────────

async function listarJuntadas(req, res, next) {
  try {
    const usuario = req.query.usuario;
    if (!usuario)
      return res.status(400).json({ ok: false, error: 'El parámetro "usuario" es requerido para listar las juntadas.' });

    console.log('Usuario recibido:', usuario);

    const { rows: ids } = await pool.query(
      `SELECT DISTINCT j.id::text, j.creada_en
       FROM juntadas j
       JOIN juntada_participantes p ON p.juntada_id = j.id
       WHERE LOWER(p.nombre) = LOWER($1)
       ORDER BY j.creada_en DESC`,
      [usuario]
    );

    const juntadas = await Promise.all(ids.map(({ id }) => cargarJuntadaCompleta(id)));

    const resultado = juntadas.map((juntada) => {
      const balance = calcularBalance(juntada);
      const saldoUsuario = balance.saldos.find(
        (s) => s.nombre.toLowerCase() === usuario.toLowerCase()
      );
      const saldoNeto = saldoUsuario
        ? (typeof saldoUsuario.saldoPendiente === 'number' ? saldoUsuario.saldoPendiente : saldoUsuario.saldo)
        : 0;

      return {
        id: juntada.id,
        nombre: juntada.nombre,
        descripcion: juntada.descripcion,
        fecha: juntada.fecha,
        cantidadParticipantes: juntada.participantes.length,
        cantidadGastos: juntada.gastos.length,
        totalGastado: balance.totalGastado,
        participantes: juntada.participantes,
        deuda: Math.abs(saldoNeto),
        tipo: saldoUsuario
          ? saldoNeto > 0.01 ? 'cobrar' : saldoNeto < -0.01 ? 'pagar' : 'ninguna'
          : 'ninguna',
      };
    });

    res.json({ ok: true, data: resultado });
  } catch (err) {
    next(err);
  }
}

async function crearJuntada(req, res, next) {
  try {
    const { nombre, descripcion = '' } = req.body;

    if (!nombre || nombre.trim() === '') {
      const err = new Error('El campo "nombre" es requerido.'); err.status = 400; return next(err);
    }

    // req.user proviene del JWT verificado por requireAuth
    const { rows: [creador] } = await pool.query(
      'SELECT id, name, iniciales FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (!creador) {
      const err = new Error('Usuario creador no encontrado.'); err.status = 404; return next(err);
    }

    const id = uuidv4();
    const fecha = new Date().toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO juntadas (id, nombre, descripcion, creador_id, fecha)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, nombre.trim(), descripcion.trim(), req.user.id, fecha]
    );

    // Agregar al creador como único participante inicial
    const pid = uuidv4();
    const pnombre = creador.name.trim();
    const piniciales = creador.iniciales || getIniciales(pnombre);
    const pcolor = COLORES_DISPONIBLES[0];

    await pool.query(
      `INSERT INTO juntada_participantes (id, juntada_id, nombre, iniciales, color)
       VALUES ($1, $2, $3, $4, $5)`,
      [pid, id, pnombre, piniciales, pcolor]
    );

    res.status(201).json({
      ok: true,
      data: {
        id, nombre: nombre.trim(), descripcion: descripcion.trim(),
        fecha, creadaEn: new Date().toISOString(),
        participantes: [{ id: pid, nombre: pnombre, iniciales: piniciales, color: pcolor }],
        gastos: [], subgrupos: [],
      },
    });
  } catch (err) {
    next(err);
  }
}

async function obtenerJuntada(req, res, next) {
  try {
    let juntada = await cargarJuntadaCompleta(req.params.id);
    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404; return next(err);
    }

    const nombreUsuario = String(req.user?.name || '').trim().toLowerCase();
    const esParticipante = Boolean(
      nombreUsuario &&
      Array.isArray(juntada.participantes) &&
      juntada.participantes.some((p) => String(p?.nombre || '').trim().toLowerCase() === nombreUsuario)
    );

    if (!esParticipante) {
      const err = new Error('No pertenecés a esta juntada.');
      err.status = 403; return next(err);
    }

    // Backfill para juntadas legacy sin creador_id.
    if (!juntada.creadorId) {
      await pool.query(
        'UPDATE juntadas SET creador_id = $1 WHERE id = $2 AND creador_id IS NULL',
        [req.user.id, req.params.id]
      );
      juntada = await cargarJuntadaCompleta(req.params.id);
    }

    const balance = calcularBalance(juntada);
    const { rows: perfiles } = await pool.query('SELECT nombre, alias FROM perfiles');
    const perfilesMap = Object.fromEntries(perfiles.map((p) => [p.nombre, p.alias]));
    balance.transferencias = balance.transferencias.map((t) => ({
      ...t, aliasDestino: perfilesMap[t.para] || null,
    }));

    const esCreador = Boolean(
      juntada?.creadorId && req.user?.id &&
      normalizeId(juntada.creadorId) === normalizeId(req.user.id)
    );

    res.json({ ok: true, data: { ...juntada, balance, esCreador } });
  } catch (err) {
    next(err);
  }
}

async function editarJuntada(req, res, next) {
  try {
    const { rows: [existing] } = await pool.query(
      'SELECT id, nombre, creador_id::text AS "creadorId" FROM juntadas WHERE id = $1',
      [req.params.id]
    );
    if (!existing) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404; return next(err);
    }

    let creadorId = existing.creadorId;
    if (!creadorId) {
      const { rows: [participa] } = await pool.query(
        `SELECT 1
         FROM juntada_participantes
         WHERE juntada_id = $1 AND LOWER(nombre) = LOWER($2)
         LIMIT 1`,
        [req.params.id, req.user?.name || '']
      );
      if (participa) {
        await pool.query(
          'UPDATE juntadas SET creador_id = $1 WHERE id = $2 AND creador_id IS NULL',
          [req.user.id, req.params.id]
        );
        creadorId = req.user.id;
      }
    }

    if (!creadorId || normalizeId(creadorId) !== normalizeId(req.user.id)) {
      const err = new Error('Solo el anfitrión de la juntada puede editar sus datos.');
      err.status = 403; return next(err);
    }

    const { nombre, descripcion, participantes } = req.body;

    if (nombre !== undefined || descripcion !== undefined) {
      const updates = []; const values = []; let idx = 1;
      if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); values.push(nombre.trim()); }
      if (descripcion !== undefined) { updates.push(`descripcion = $${idx++}`); values.push(descripcion.trim()); }
      values.push(req.params.id);
      await pool.query(`UPDATE juntadas SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    let nombresNuevos = [];
    if (Array.isArray(participantes)) {
      const { rows: existingParts } = await pool.query(
        'SELECT nombre FROM juntada_participantes WHERE juntada_id = $1', [req.params.id]
      );
      const nombresActuales = new Set(existingParts.map((p) => p.nombre.toLowerCase()));
      const baseIndex = existingParts.length;

      const nuevos = participantes
        .filter((p) => p?.nombre && p.nombre.trim() !== '')
        .filter((p) => !nombresActuales.has(p.nombre.trim().toLowerCase()))
        .map((p, idx) => ({
          id: p.id || uuidv4(),
          nombre: p.nombre.trim(),
          iniciales: p.iniciales || getIniciales(p.nombre.trim()),
          color: p.color || COLORES_DISPONIBLES[(baseIndex + idx) % COLORES_DISPONIBLES.length],
        }));

      for (const p of nuevos) {
        await pool.query(
          `INSERT INTO juntada_participantes (id, juntada_id, nombre, iniciales, color)
           VALUES ($1, $2, $3, $4, $5)`,
          [p.id, req.params.id, p.nombre, p.iniciales, p.color]
        );
      }
      nombresNuevos = nuevos.map((p) => p.nombre);
    }

    const juntada = await cargarJuntadaCompleta(req.params.id);

    if (nombresNuevos.length > 0) {
      notifyUsersByName(nombresNuevos, {
        title: 'Te agregaron a una juntada',
        body: `Ahora participas en "${juntada.nombre}"`,
        data: { type: 'juntada_invite', juntadaId: juntada.id, juntadaNombre: juntada.nombre },
      }, { category: NOTIFICATION_CATEGORIES.NUEVAS_JUNTADAS }).catch((err) => {
        console.error('[push] Error enviando notificacion de juntada:', err.message);
      });
    }

    res.json({ ok: true, data: juntada });
  } catch (err) {
    next(err);
  }
}

async function eliminarJuntada(req, res, next) {
  try {
    const { rows: [existing] } = await pool.query(
      'SELECT id, nombre, creador_id::text AS "creadorId" FROM juntadas WHERE id = $1',
      [req.params.id]
    );
    if (!existing) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404; return next(err);
    }

    let creadorId = existing.creadorId;
    if (!creadorId) {
      const { rows: [participa] } = await pool.query(
        `SELECT 1
         FROM juntada_participantes
         WHERE juntada_id = $1 AND LOWER(nombre) = LOWER($2)
         LIMIT 1`,
        [req.params.id, req.user?.name || '']
      );
      if (participa) {
        await pool.query(
          'UPDATE juntadas SET creador_id = $1 WHERE id = $2 AND creador_id IS NULL',
          [req.user.id, req.params.id]
        );
        creadorId = req.user.id;
      }
    }

    if (!creadorId || normalizeId(creadorId) !== normalizeId(req.user.id)) {
      const err = new Error('Solo el anfitrión de la juntada puede eliminarla.');
      err.status = 403; return next(err);
    }

    await pool.query('DELETE FROM juntadas WHERE id = $1', [req.params.id]);
    res.json({ ok: true, mensaje: 'Juntada eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
}

// ── Participantes ─────────────────────────────────────────────────────────────

async function agregarParticipante(req, res, next) {
  try {
    const { rows: [juntada] } = await pool.query('SELECT id FROM juntadas WHERE id = $1', [req.params.id]);
    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404; return next(err);
    }

    const { nombre, iniciales, color } = req.body;
    if (!nombre || nombre.trim() === '') {
      const err = new Error('El campo "nombre" del participante es requerido.');
      err.status = 400; return next(err);
    }

    const nombreLimpio = nombre.trim();
    const { rows: existing } = await pool.query(
      'SELECT id FROM juntada_participantes WHERE juntada_id = $1 AND LOWER(nombre) = LOWER($2)',
      [req.params.id, nombreLimpio]
    );
    if (existing.length > 0) {
      const err = new Error(`El participante "${nombreLimpio}" ya está en esta juntada.`);
      err.status = 409; return next(err);
    }

    const { rows: [countRow] } = await pool.query(
      'SELECT COUNT(*)::int AS c FROM juntada_participantes WHERE juntada_id = $1', [req.params.id]
    );
    const colorAsignado = color || COLORES_DISPONIBLES[countRow.c % COLORES_DISPONIBLES.length];
    const pid = uuidv4();

    await pool.query(
      `INSERT INTO juntada_participantes (id, juntada_id, nombre, iniciales, color)
       VALUES ($1, $2, $3, $4, $5)`,
      [pid, req.params.id, nombreLimpio, iniciales || getIniciales(nombreLimpio), colorAsignado]
    );

    res.status(201).json({
      ok: true,
      data: { id: pid, nombre: nombreLimpio, iniciales: iniciales || getIniciales(nombreLimpio), color: colorAsignado },
    });
  } catch (err) {
    next(err);
  }
}

async function quitarParticipante(req, res, next) {
  try {
    const { rows: [participante] } = await pool.query(
      'SELECT id, nombre FROM juntada_participantes WHERE id = $1 AND juntada_id = $2',
      [req.params.pid, req.params.id]
    );
    if (!participante) {
      const err = new Error(`Participante con id "${req.params.pid}" no encontrado.`);
      err.status = 404; return next(err);
    }

    const { rows: gastos } = await pool.query(
      'SELECT id FROM juntada_gastos WHERE juntada_id = $1 AND LOWER(pagador) = LOWER($2)',
      [req.params.id, participante.nombre]
    );
    if (gastos.length > 0) {
      const err = new Error(`No se puede quitar a "${participante.nombre}" porque tiene gastos registrados en esta juntada.`);
      err.status = 422; return next(err);
    }

    await pool.query('DELETE FROM juntada_participantes WHERE id = $1', [req.params.pid]);
    res.json({ ok: true, mensaje: `Participante "${participante.nombre}" eliminado.` });
  } catch (err) {
    next(err);
  }
}

// ── Gastos ────────────────────────────────────────────────────────────────────

async function agregarGasto(req, res, next) {
  try {
    const juntada = await cargarJuntadaCompleta(req.params.id);
    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404; return next(err);
    }

    const {
      nombre, pagador, monto,
      splitMode = 'equal', splitSubgroups = [], beneficiarios = [], ticketPhoto = null,
    } = req.body;

    if (!nombre || nombre.trim() === '') {
      const err = new Error('El campo "nombre" del gasto es requerido.'); err.status = 400; return next(err);
    }
    if (!pagador || pagador.trim() === '') {
      const err = new Error('El campo "pagador" es requerido.'); err.status = 400; return next(err);
    }
    if (typeof monto !== 'number' || monto <= 0) {
      const err = new Error('El campo "monto" debe ser un número mayor a 0.'); err.status = 400; return next(err);
    }

    const esParticipante = juntada.participantes.some(
      (p) => p.nombre.toLowerCase() === pagador.trim().toLowerCase()
    );
    if (!esParticipante) {
      const err = new Error(`"${pagador}" no es un participante de esta juntada. Agregalo primero.`);
      err.status = 422; return next(err);
    }

    if (beneficiarios.length > 0) {
      const nombresValidos = juntada.participantes.map((p) => p.nombre.toLowerCase());
      const invalidos = beneficiarios.filter((b) => !nombresValidos.includes(b.trim().toLowerCase()));
      if (invalidos.length > 0) {
        const err = new Error(`Los siguientes beneficiarios no pertenecen a la juntada: ${invalidos.join(', ')}`);
        err.status = 422; return next(err);
      }
    }

    const id = uuidv4();
    const montoRedondeado = Math.round(monto * 100) / 100;

    await pool.query(
      `INSERT INTO juntada_gastos
         (id, juntada_id, nombre, pagador, monto, split_mode, split_subgroups, beneficiarios, ticket_photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, req.params.id, nombre.trim(), pagador.trim(), montoRedondeado,
       splitMode, splitSubgroups, beneficiarios.map((b) => b.trim()), ticketPhoto]
    );

    const nuevo = {
      id, nombre: nombre.trim(), pagador: pagador.trim(),
      splitMode, splitSubgroups, beneficiarios: beneficiarios.map((b) => b.trim()),
      monto: montoRedondeado, ticketPhoto, creadoEn: new Date().toISOString(),
    };

    const receptores = juntada.participantes
      .map((p) => p.nombre)
      .filter((n) => n.trim().toLowerCase() !== pagador.trim().toLowerCase());

    if (receptores.length > 0) {
      notifyUsersByName(receptores, {
        title: 'Nuevo gasto en juntada',
        body: `${pagador.trim()} agrego "${nombre.trim()}" en ${juntada.nombre}.`,
        data: { type: 'new_expense', juntadaId: juntada.id, juntadaNombre: juntada.nombre, gastoId: id },
      }, { category: NOTIFICATION_CATEGORIES.NUEVOS_GASTOS }).catch((err) => {
        console.error('[push] Error enviando notificacion de nuevo gasto:', err.message);
      });
    }

    res.status(201).json({ ok: true, data: nuevo });
  } catch (err) {
    next(err);
  }
}

async function eliminarGasto(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM juntada_gastos WHERE id = $1 AND juntada_id = $2',
      [req.params.gid, req.params.id]
    );
    if (rowCount === 0) {
      const err = new Error(`Gasto con id "${req.params.gid}" no encontrado.`);
      err.status = 404; return next(err);
    }
    res.json({ ok: true, mensaje: 'Gasto eliminado correctamente.' });
  } catch (err) {
    next(err);
  }
}

// ── Balance ───────────────────────────────────────────────────────────────────

async function obtenerBalance(req, res, next) {
  try {
    const juntada = await cargarJuntadaCompleta(req.params.id);
    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404; return next(err);
    }
    const balance = calcularBalance(juntada);
    const { rows: perfiles } = await pool.query('SELECT nombre, alias FROM perfiles');
    const perfilesMap = Object.fromEntries(perfiles.map((p) => [p.nombre, p.alias]));
    balance.transferencias = balance.transferencias.map((t) => ({
      ...t, aliasDestino: perfilesMap[t.para] || null,
    }));
    res.json({ ok: true, data: balance });
  } catch (err) {
    next(err);
  }
}

async function obtenerBalanceGlobal(req, res, next) {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const { rows: ids } = await pool.query(
      `SELECT DISTINCT j.id::text FROM juntadas j
       JOIN juntada_participantes p ON p.juntada_id = j.id
       WHERE LOWER(p.nombre) = LOWER($1)`,
      [nombre]
    );
    const juntadas = await Promise.all(ids.map(({ id }) => cargarJuntadaCompleta(id)));
    const balance = calcularBalanceGlobal(nombre, juntadas);
    res.json({ ok: true, data: balance });
  } catch (err) {
    next(err);
  }
}

// ── Subgrupos ─────────────────────────────────────────────────────────────────

const agregarSubgrupo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, integrantes } = req.body;

    if (!nombre || !integrantes || integrantes.length < 1)
      return res.status(400).json({ error: 'El subgrupo debe tener un nombre y al menos 1 integrante.' });

    const { rows: [juntada] } = await pool.query('SELECT id FROM juntadas WHERE id = $1', [id]);
    if (!juntada) return res.status(404).json({ error: 'Juntada no encontrada' });

    const sgId = uuidv4();
    await pool.query(
      'INSERT INTO juntada_subgrupos (id, juntada_id, nombre) VALUES ($1, $2, $3)',
      [sgId, id, nombre.trim()]
    );
    for (const integrante of integrantes) {
      await pool.query(
        'INSERT INTO subgrupo_integrantes (subgrupo_id, nombre) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [sgId, integrante]
      );
    }

    res.status(201).json({ ok: true, data: { id: sgId, nombre: nombre.trim(), integrantes } });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear el subgrupo' });
  }
};

const editarSubgrupo = async (req, res) => {
  try {
    const { id, sgid } = req.params;
    const { nombre, integrantes } = req.body;

    if (!nombre || !integrantes || integrantes.length < 1)
      return res.status(400).json({ error: 'El subgrupo debe tener un nombre y al menos 1 integrante.' });

    const { rows: [sg] } = await pool.query(
      'SELECT id FROM juntada_subgrupos WHERE id = $1 AND juntada_id = $2', [sgid, id]
    );
    if (!sg) return res.status(404).json({ error: 'Subgrupo no encontrado' });

    await pool.query('UPDATE juntada_subgrupos SET nombre = $1 WHERE id = $2', [nombre.trim(), sgid]);
    await pool.query('DELETE FROM subgrupo_integrantes WHERE subgrupo_id = $1', [sgid]);
    for (const integrante of integrantes) {
      await pool.query(
        'INSERT INTO subgrupo_integrantes (subgrupo_id, nombre) VALUES ($1, $2)', [sgid, integrante]
      );
    }

    res.json({ ok: true, data: { id: sgid, nombre: nombre.trim(), integrantes } });
  } catch (error) {
    res.status(500).json({ error: 'Error al editar el subgrupo' });
  }
};

const eliminarSubgrupo = async (req, res) => {
  try {
    const { id, sgid } = req.params;
    const { rowCount } = await pool.query(
      'DELETE FROM juntada_subgrupos WHERE id = $1 AND juntada_id = $2', [sgid, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Subgrupo no encontrado' });
    res.status(200).json({ ok: true, mensaje: 'Subgrupo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el subgrupo' });
  }
};

// ── Invitaciones ─────────────────────────────────────────────────────────────

async function generarObtenerInvitacion(req, res, next) {
  try {
    const juntadaId = req.params.id;
    const { rows: [juntada] } = await pool.query('SELECT id, nombre FROM juntadas WHERE id = $1', [juntadaId]);
    if (!juntada) {
      const err = new Error(`Juntada con id "${juntadaId}" no encontrada.`);
      err.status = 404; return next(err);
    }

    // Reutilizar token existente no expirado
    const { rows: [existing] } = await pool.query(
      `SELECT token::text FROM invitation_tokens
       WHERE recurso_id = $1 AND tipo = 'juntada' AND expira_en > NOW()
       ORDER BY creado_en DESC LIMIT 1`,
      [juntadaId]
    );

    let token;
    if (existing) {
      token = existing.token;
    } else {
      token = uuidv4();
      await pool.query(
        `INSERT INTO invitation_tokens (token, tipo, recurso_id, creado_por, expira_en)
         VALUES ($1, 'juntada', $2, $3, NOW() + INTERVAL '7 days')`,
        [token, juntadaId, req.user?.id || null]
      );
    }

    res.json({
      ok: true,
      data: {
        token,
        deepLink: `mitimiti://join/${token}`,
        juntadaNombre: juntada.nombre,
        expiraEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function unirseViaToken(req, res, next) {
  try {
    const { token } = req.params;
    const usuarioId = req.user.id;

    // Validar token
    const { rows: [inv] } = await pool.query(
      `SELECT token, tipo, recurso_id::text FROM invitation_tokens
       WHERE token = $1 AND expira_en > NOW()`,
      [token]
    );
    if (!inv) {
      const err = new Error('Enlace de invitación inválido o expirado.'); err.status = 404; return next(err);
    }

    // Obtener info del usuario
    const { rows: [usuario] } = await pool.query(
      'SELECT name, iniciales FROM usuarios WHERE id = $1', [usuarioId]
    );
    if (!usuario) {
      const err = new Error('Usuario no encontrado.'); err.status = 404; return next(err);
    }

    if (inv.tipo === 'juntada') {
      const juntadaId = inv.recurso_id;

      // Verificar si ya es participante
      const { rows: yaParticipante } = await pool.query(
        'SELECT id FROM juntada_participantes WHERE juntada_id = $1 AND LOWER(nombre) = LOWER($2)',
        [juntadaId, usuario.name]
      );
      if (yaParticipante.length > 0) {
        const juntada = await cargarJuntadaCompleta(juntadaId);
        return res.json({ ok: true, data: { juntada, yaMiembro: true } });
      }

      // Agregar como participante
      const { rows: [countRow] } = await pool.query(
        'SELECT COUNT(*)::int AS c FROM juntada_participantes WHERE juntada_id = $1', [juntadaId]
      );
      const pid = uuidv4();
      const color = COLORES_DISPONIBLES[countRow.c % COLORES_DISPONIBLES.length];

      await pool.query(
        `INSERT INTO juntada_participantes (id, juntada_id, nombre, iniciales, color)
         VALUES ($1, $2, $3, $4, $5)`,
        [pid, juntadaId, usuario.name, usuario.iniciales || getIniciales(usuario.name), color]
      );

      const juntada = await cargarJuntadaCompleta(juntadaId);

      // Notificar a los demás participantes
      const otros = juntada.participantes
        .map(p => p.nombre)
        .filter(n => n.toLowerCase() !== usuario.name.toLowerCase());
      if (otros.length > 0) {
        notifyUsersByName(otros, {
          title: 'Nuevo integrante en la juntada',
          body: `${usuario.name} se unió a "${juntada.nombre}"`,
          data: { type: 'juntada_invite', juntadaId, juntadaNombre: juntada.nombre },
        }, { category: NOTIFICATION_CATEGORIES.NUEVAS_JUNTADAS }).catch(() => {});
      }

      return res.status(201).json({ ok: true, data: { juntada, yaMiembro: false } });
    }

    const err = new Error('Tipo de invitación no soportado.'); err.status = 400; return next(err);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarJuntadas, crearJuntada, editarJuntada, obtenerJuntada, eliminarJuntada,
  agregarParticipante, quitarParticipante,
  agregarGasto, eliminarGasto,
  obtenerBalance, obtenerBalanceGlobal,
  agregarSubgrupo, editarSubgrupo, eliminarSubgrupo,
  generarObtenerInvitacion, unirseViaToken,
};
