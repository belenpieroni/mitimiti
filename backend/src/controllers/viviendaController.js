const { randomUUID: uuidv4 } = require('crypto');
const { pool } = require('../db');

const slugify = (txt = '') =>
  String(txt)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '');

async function obtenerMiViviendaBase(usuarioId) {
  const { rows: [vivienda] } = await pool.query(
    `SELECT v.id::text, v.nombre, v.creador_id::text AS "creadorId", v.creada_en AS "creadaEn"
     FROM viviendas v
     JOIN vivienda_miembros vm ON vm.vivienda_id = v.id
     WHERE vm.usuario_id = $1
     ORDER BY vm.unido_en DESC
     LIMIT 1`,
    [usuarioId]
  );
  return vivienda || null;
}

async function obtenerMiembrosVivienda(viviendaId) {
  const { rows } = await pool.query(
    `SELECT u.id::text, u.name
     FROM vivienda_miembros vm
     JOIN usuarios u ON u.id = vm.usuario_id
     WHERE vm.vivienda_id = $1
     ORDER BY u.name`,
    [viviendaId]
  );
  return rows;
}

async function obtenerMiVivienda(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) {
      return res.json({ ok: true, data: null });
    }

    const miembros = await obtenerMiembrosVivienda(vivienda.id);
    res.json({
      ok: true,
      data: {
        ...vivienda,
        miembros,
        esCreador: vivienda.creadorId === req.user.id,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function crearMiVivienda(req, res, next) {
  try {
    const yaTiene = await obtenerMiViviendaBase(req.user.id);
    if (yaTiene) {
      const err = new Error('Ya pertenecés a una vivienda.');
      err.status = 409;
      return next(err);
    }

    const { rows: [usuario] } = await pool.query(
      'SELECT name FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (!usuario) {
      const err = new Error('Usuario no encontrado.');
      err.status = 404;
      return next(err);
    }

    const nombre = (req.body?.nombre || '').trim() || `Vivienda de ${usuario.name}`;
    const viviendaId = uuidv4();

    await pool.query(
      'INSERT INTO viviendas (id, nombre, creador_id) VALUES ($1, $2, $3)',
      [viviendaId, nombre, req.user.id]
    );
    await pool.query(
      'INSERT INTO vivienda_miembros (vivienda_id, usuario_id) VALUES ($1, $2)',
      [viviendaId, req.user.id]
    );

    res.status(201).json({
      ok: true,
      data: {
        id: viviendaId,
        nombre,
        creadorId: req.user.id,
        miembros: [{ id: req.user.id, name: usuario.name }],
        esCreador: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function editarMiVivienda(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    if (vivienda.creadorId !== req.user.id) {
      const err = new Error('Solo el creador puede editar la vivienda.');
      err.status = 403;
      return next(err);
    }

    const nombre = (req.body?.nombre || '').trim();
    if (!nombre) {
      const err = new Error('El nombre de la vivienda es obligatorio.');
      err.status = 400;
      return next(err);
    }

    await pool.query('UPDATE viviendas SET nombre = $1 WHERE id = $2', [nombre, vivienda.id]);
    res.json({ ok: true, data: { ...vivienda, nombre, esCreador: true } });
  } catch (err) {
    next(err);
  }
}

async function eliminarMiVivienda(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    if (vivienda.creadorId !== req.user.id) {
      const err = new Error('Solo el creador puede eliminar la vivienda.');
      err.status = 403;
      return next(err);
    }

    await pool.query('DELETE FROM viviendas WHERE id = $1', [vivienda.id]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

async function generarObtenerInvitacion(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) {
      const err = new Error('Primero tenés que crear o unirte a una vivienda.');
      err.status = 404;
      return next(err);
    }

    const { rows: [existing] } = await pool.query(
      `SELECT token::text FROM invitation_tokens
       WHERE recurso_id = $1 AND tipo = 'vivienda' AND expira_en > NOW()
       ORDER BY creado_en DESC LIMIT 1`,
      [vivienda.id]
    );

    let token;
    if (existing) {
      token = existing.token;
    } else {
      token = uuidv4();
      await pool.query(
        `INSERT INTO invitation_tokens (token, tipo, recurso_id, creado_por, expira_en)
         VALUES ($1, 'vivienda', $2, $3, NOW() + INTERVAL '7 days')`,
        [token, vivienda.id, req.user.id]
      );
    }

    res.json({
      ok: true,
      data: {
        token,
        deepLink: `mitimiti://vivienda/join/${token}`,
        viviendaNombre: vivienda.nombre,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function unirseViaToken(req, res, next) {
  try {
    const { token } = req.params;

    const actual = await obtenerMiViviendaBase(req.user.id);
    if (actual) {
      const err = new Error('Ya pertenecés a una vivienda.');
      err.status = 409;
      return next(err);
    }

    const { rows: [inv] } = await pool.query(
      `SELECT token, tipo, recurso_id::text FROM invitation_tokens
       WHERE token = $1 AND tipo = 'vivienda' AND expira_en > NOW()`,
      [token]
    );
    if (!inv) {
      const err = new Error('Enlace de vivienda inválido o expirado.');
      err.status = 404;
      return next(err);
    }

    await pool.query(
      `INSERT INTO vivienda_miembros (vivienda_id, usuario_id)
       VALUES ($1, $2)
       ON CONFLICT (vivienda_id, usuario_id) DO NOTHING`,
      [inv.recurso_id, req.user.id]
    );

    const vivienda = await obtenerMiViviendaBase(req.user.id);
    const miembros = await obtenerMiembrosVivienda(vivienda.id);

    res.status(201).json({
      ok: true,
      data: {
        ...vivienda,
        miembros,
        esCreador: vivienda.creadorId === req.user.id,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function obtenerMiViviendaOrFail(req) {
  const vivienda = await obtenerMiViviendaBase(req.user.id);
  if (!vivienda) {
    const err = new Error('No pertenecés a ninguna vivienda.');
    err.status = 404;
    throw err;
  }
  return vivienda;
}

// ── Gastos ────────────────────────────────────────────────────────────────────

async function listarGastos(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) return res.json({ ok: true, data: [] });

    const { rows } = await pool.query(
      `SELECT id::text, nombre, monto::float, categoria, fecha::text, pagador,
              imagen_url AS "imagenUrl", participantes, creado_en AS "creadoEn"
       FROM vivienda_gastos
       WHERE vivienda_id = $1
       ORDER BY fecha DESC, creado_en DESC`,
      [vivienda.id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function crearGasto(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { nombre, monto, categoria, fecha, pagador, participantes = [], imagenUrl } = req.body;

    if (!nombre || !monto || !categoria || !fecha || !pagador) {
      const err = new Error('Faltan campos obligatorios para crear un gasto.');
      err.status = 400; return next(err);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO vivienda_gastos (id, vivienda_id, nombre, monto, categoria, fecha, pagador, imagen_url, participantes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, vivienda.id, nombre, Number(monto), categoria, fecha, pagador, imagenUrl || null, participantes]
    );

    res.status(201).json({
      ok: true,
      data: { id, nombre, monto: Number(monto), categoria, fecha, pagador, imagenUrl: imagenUrl || null, participantes },
    });
  } catch (err) {
    next(err);
  }
}

async function editarGasto(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;
    const { nombre, monto, categoria, fecha, pagador, participantes, imagenUrl } = req.body;

    const { rows: [existing] } = await pool.query(
      'SELECT id FROM vivienda_gastos WHERE id = $1 AND vivienda_id = $2', [id, vivienda.id]
    );
    if (!existing) {
      const err = new Error('Gasto no encontrado'); err.status = 404; return next(err);
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE vivienda_gastos SET
         nombre = COALESCE($1, nombre),
         monto = COALESCE($2, monto),
         categoria = COALESCE($3, categoria),
         fecha = COALESCE($4, fecha),
         pagador = COALESCE($5, pagador),
         participantes = COALESCE($6, participantes),
         imagen_url = COALESCE($7, imagen_url)
       WHERE id = $8 AND vivienda_id = $9
       RETURNING id::text, nombre, monto::float, categoria, fecha::text, pagador,
                 imagen_url AS "imagenUrl", participantes`,
      [nombre || null, monto != null ? Number(monto) : null, categoria || null,
       fecha || null, pagador || null, participantes || null, imagenUrl || null, id, vivienda.id]
    );

    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Servicios periódicos ──────────────────────────────────────────────────────

async function listarServicios(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) return res.json({ ok: true, data: [] });

    const { rows } = await pool.query(
      `SELECT id::text, nombre, monto::float, periodicidad,
              proximo_vencimiento::text AS "proximoVencimiento",
              participantes, creado_en AS "creadoEn"
       FROM vivienda_servicios
       WHERE vivienda_id = $1
       ORDER BY proximo_vencimiento`,
      [vivienda.id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function crearServicio(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { nombre, monto, periodicidad, proximoVencimiento, participantes = [] } = req.body;

    if (!nombre || !monto || !periodicidad || !proximoVencimiento) {
      const err = new Error('Faltan campos obligatorios para crear un servicio periódico.');
      err.status = 400; return next(err);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO vivienda_servicios (id, vivienda_id, nombre, monto, periodicidad, proximo_vencimiento, participantes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, vivienda.id, nombre, Number(monto), periodicidad, proximoVencimiento, participantes]
    );

    res.status(201).json({
      ok: true,
      data: { id, nombre, monto: Number(monto), periodicidad, proximoVencimiento, participantes },
    });
  } catch (err) {
    next(err);
  }
}

async function editarServicio(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;
    const { nombre, monto, periodicidad, proximoVencimiento, participantes } = req.body;

    const { rows: [existing] } = await pool.query(
      'SELECT id FROM vivienda_servicios WHERE id = $1 AND vivienda_id = $2', [id, vivienda.id]
    );
    if (!existing) {
      const err = new Error('Servicio no encontrado'); err.status = 404; return next(err);
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE vivienda_servicios SET
         nombre = COALESCE($1, nombre),
         monto = COALESCE($2, monto),
         periodicidad = COALESCE($3, periodicidad),
         proximo_vencimiento = COALESCE($4, proximo_vencimiento),
         participantes = COALESCE($5, participantes)
       WHERE id = $6 AND vivienda_id = $7
       RETURNING id::text, nombre, monto::float, periodicidad,
                 proximo_vencimiento::text AS "proximoVencimiento", participantes`,
      [nombre || null, monto != null ? Number(monto) : null, periodicidad || null,
       proximoVencimiento || null, participantes || null, id, vivienda.id]
    );

    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function eliminarServicio(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;

    const { rows: [servicio] } = await pool.query(
      'SELECT id FROM vivienda_servicios WHERE id::text = $1 AND vivienda_id = $2', [id, vivienda.id]
    );

    if (!servicio) {
      const err = new Error('Servicio no encontrado'); err.status = 404; return next(err);
    }

    await pool.query('DELETE FROM vivienda_servicios WHERE id = $1 AND vivienda_id = $2', [servicio.id, vivienda.id]);
    res.json({ ok: true, data: servicio });
  } catch (err) {
    next(err);
  }
}

// ── Acuerdos de reparto ───────────────────────────────────────────────────────

async function listarAcuerdos(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) return res.json({ ok: true, data: [] });

    const { rows: acuerdos } = await pool.query(
      'SELECT id, nombre, modelo FROM vivienda_acuerdos WHERE vivienda_id = $1',
      [vivienda.id]
    );

    const resultado = await Promise.all(
      acuerdos.map(async (a) => {
        const { rows: participantes } = await pool.query(
          'SELECT nombre, porcentaje::float FROM acuerdo_participantes WHERE acuerdo_id = $1',
          [a.id]
        );
        return { ...a, participantes };
      })
    );

    res.json({ ok: true, data: resultado });
  } catch (err) {
    next(err);
  }
}

async function guardarAcuerdo(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { nombre, modelo, participantes } = req.body;
    const key = `${vivienda.id}_${slugify(nombre)}`;

    await pool.query(
      `INSERT INTO vivienda_acuerdos (id, vivienda_id, nombre, modelo) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET nombre = $3, modelo = $4`,
      [key, vivienda.id, nombre, modelo]
    );

    await pool.query('DELETE FROM acuerdo_participantes WHERE acuerdo_id = $1', [key]);
    if (Array.isArray(participantes)) {
      for (const p of participantes) {
        await pool.query(
          'INSERT INTO acuerdo_participantes (acuerdo_id, nombre, porcentaje) VALUES ($1, $2, $3)',
          [key, p.nombre, p.porcentaje]
        );
      }
    }

    res.status(201).json({ ok: true, data: { id: key, nombre, modelo, participantes: participantes || [] } });
  } catch (err) {
    next(err);
  }
}

async function eliminarAcuerdo(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const id = req.params.id.toLowerCase().trim();
    const { rowCount } = await pool.query(
      'DELETE FROM vivienda_acuerdos WHERE id = $1 AND vivienda_id = $2',
      [id, vivienda.id]
    );

    if (rowCount === 0)
      return res.status(404).json({ ok: false, message: 'ID no encontrado' });

    res.status(200).json({ ok: true, message: 'Eliminado' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  obtenerMiVivienda,
  crearMiVivienda,
  editarMiVivienda,
  eliminarMiVivienda,
  generarObtenerInvitacion,
  unirseViaToken,
  listarGastos, crearGasto, editarGasto,
  listarServicios, crearServicio, editarServicio, eliminarServicio,
  listarAcuerdos, guardarAcuerdo, eliminarAcuerdo,
};
