const { randomUUID: uuidv4 } = require('crypto');
const { pool } = require('../db');
const { notifyUsersByName, NOTIFICATION_CATEGORIES } = require('../services/pushNotificationService');

const limpiarMontoOCR = (montoString) => {
  if (!montoString) return null;

  // 1. Convertimos a string y eliminamos espacios
  let valor = montoString.toString().trim();

  // 2. Identificar el último signo de puntuación (asumiendo que es decimal)
  // Buscamos la última ocurrencia de ',' o '.'
  const ultimoPunto = valor.lastIndexOf('.');
  const ultimaComa = valor.lastIndexOf(',');
  const separadorIndex = Math.max(ultimoPunto, ultimaComa);

  if (separadorIndex !== -1) {
    // Tenemos separador decimal.
    // Separamos la parte entera y la decimal
    let parteEntera = valor.substring(0, separadorIndex);
    let parteDecimal = valor.substring(separadorIndex + 1);

    // Eliminamos cualquier punto o coma de la parte entera (limpieza de miles)
    parteEntera = parteEntera.replace(/[.,]/g, '');

    // Unimos con punto decimal estándar de JavaScript
    return parseFloat(`${parteEntera}.${parteDecimal}`);
  } else {
    // Si no hay separador, solo limpiamos los caracteres no numéricos
    return parseFloat(valor.replace(/[^0-9]/g, ''));
  }
};

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

    const { rows: [usuario] } = await pool.query('SELECT name FROM usuarios WHERE id = $1', [req.user.id]);
    const userName = usuario ? usuario.name : '';

    const { rows } = await pool.query(
      `SELECT g.id::text, g.nombre, g.monto::float, g.categoria, g.fecha::text, g.pagador,
              g.imagen_url AS "imagenUrl", g.participantes, g.creado_en AS "creadoEn", g.status,
              g.acuerdo_id AS "acuerdoId",
              COALESCE(ap.porcentaje, 0)::float AS "miPorcentaje"
       FROM vivienda_gastos g
       LEFT JOIN acuerdo_participantes ap ON ap.acuerdo_id = g.acuerdo_id AND LOWER(ap.nombre) = LOWER($2)
       WHERE g.vivienda_id = $1
       ORDER BY g.fecha DESC, g.creado_en DESC`,
      [vivienda.id, userName]
    );

    const data = rows.map(r => {
      let miPorcentaje = r.miPorcentaje;
      // Fallback para gastos viejos sin acuerdo_id
      if (!r.acuerdoId && Array.isArray(r.participantes)) {
        const found = r.participantes.find(p => p.toLowerCase() === userName.toLowerCase());
        if (found) miPorcentaje = 100 / (r.participantes.length || 1);
      }
      return {
        ...r,
        monto_responsabilidad_usuario: r.monto ? (r.monto * miPorcentaje / 100) : 0
      };
    });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function crearGasto(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    let { acuerdoId, nombreServicio, monto, categoria, fecha, pagador, imagenUrl, participantes } = req.body;
    monto = limpiarMontoOCR(monto);

    if (!acuerdoId && (!participantes || !participantes.length)) {
      const err = new Error('Debes asociar un acuerdo o especificar participantes.');
      err.status = 400; return next(err);
    }
    if (!nombreServicio || !monto || !categoria || !fecha || !pagador) {
      const err = new Error('Faltan campos obligatorios para crear un gasto.');
      err.status = 400; return next(err);
    }

    let participantesFinales = [];
    if (acuerdoId) {
      // Consultar tabla vivienda_acuerdos (participantes)
      const { rows: partRows } = await pool.query(
        'SELECT nombre, porcentaje FROM acuerdo_participantes WHERE acuerdo_id = $1',
        [acuerdoId]
      );
      participantesFinales = partRows.map(r => r.nombre);
    } else {
      participantesFinales = participantes;
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO vivienda_gastos (id, vivienda_id, nombre, monto, categoria, fecha, pagador, imagen_url, participantes, acuerdo_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, vivienda.id, nombreServicio, Number(monto), categoria, fecha, pagador, imagenUrl || null, participantesFinales, acuerdoId || null]
    );

    const { rows: [usuario] } = await pool.query('SELECT name FROM usuarios WHERE id = $1', [req.user.id]);
    const creatorName = usuario ? usuario.name : '';

    const montoFloat = Number(monto) || 0;
    if (montoFloat > 0) {
      if (acuerdoId) {
        // Consultar de nuevo con los porcentajes para notificaciones
        const { rows: partRows } = await pool.query(
          'SELECT nombre, porcentaje FROM acuerdo_participantes WHERE acuerdo_id = $1',
          [acuerdoId]
        );
        partRows.forEach(part => {
          if (part.nombre.toLowerCase() !== creatorName.toLowerCase()) {
            const monto_individual = (montoFloat * (part.porcentaje || 0)) / 100;
            if (monto_individual > 0) {
              notifyUsersByName(
                [part.nombre],
                {
                  title: '💸 Nuevo gasto puntual',
                  body: `Se cargó ${nombreServicio}. Debes abonar $${monto_individual.toLocaleString('es-AR')} a ${pagador}.`,
                  data: { type: 'nuevo_gasto', gastoId: id, url: 'mitimiti://deudas' }
                },
                { category: NOTIFICATION_CATEGORIES.NUEVOS_GASTOS }
              ).catch(e => console.error('Error al notificar nuevo gasto:', e));
            }
          }
        });
      } else {
        // Miti-miti: partes iguales
        const share = montoFloat / (participantesFinales.length || 1);
        participantesFinales.forEach(nombre => {
          if (nombre.toLowerCase() !== creatorName.toLowerCase()) {
            notifyUsersByName(
              [nombre],
              {
                title: '💸 Nuevo gasto puntual',
                body: `Se cargó ${nombreServicio}. Debes abonar $${Math.round(share).toLocaleString('es-AR')} a ${pagador}.`,
                data: { type: 'nuevo_gasto', gastoId: id, url: 'mitimiti://deudas' }
              },
              { category: NOTIFICATION_CATEGORIES.NUEVOS_GASTOS }
            ).catch(e => console.error('Error al notificar nuevo gasto:', e));
          }
        });
      }
    }

    res.status(201).json({
      ok: true,
      data: { id, nombre: nombreServicio, monto: montoFloat, categoria, fecha, pagador, imagenUrl: imagenUrl || null, participantes: participantesFinales, acuerdoId: acuerdoId || null },
    });
  } catch (err) {
    next(err);
  }
}

async function editarGasto(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;
    let { nombreServicio, monto, categoria, fecha, pagador, acuerdoId, imagenUrl, participantes } = req.body;
    if (monto !== undefined) monto = limpiarMontoOCR(monto);

    const { rows: [existing] } = await pool.query(
      'SELECT id FROM vivienda_gastos WHERE id = $1 AND vivienda_id = $2', [id, vivienda.id]
    );
    if (!existing) {
      const err = new Error('Gasto no encontrado'); err.status = 404; return next(err);
    }

    let participantesFinales = undefined;
    if (acuerdoId) {
      const { rows: partRows } = await pool.query(
        'SELECT nombre FROM acuerdo_participantes WHERE acuerdo_id = $1',
        [acuerdoId]
      );
      participantesFinales = partRows.map(r => r.nombre);
    } else if (participantes) {
      participantesFinales = participantes;
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE vivienda_gastos SET
         nombre = COALESCE($1, nombre),
         monto = COALESCE($2, monto),
         categoria = COALESCE($3, categoria),
         fecha = COALESCE($4, fecha),
         pagador = COALESCE($5, pagador),
         participantes = COALESCE($6, participantes),
         imagen_url = COALESCE($7, imagen_url),
         acuerdo_id = CASE WHEN $8 = true THEN $9 ELSE acuerdo_id END
       WHERE id = $10 AND vivienda_id = $11
       RETURNING id::text, nombre, monto::float, categoria, fecha::text, pagador,
                 imagen_url AS "imagenUrl", participantes, acuerdo_id AS "acuerdoId"`,
      [
        nombreServicio || null,
        monto != null ? Number(monto) : null,
        categoria || null,
        fecha || null,
        pagador || null,
        participantesFinales || null,
        imagenUrl || null,
        req.body.hasOwnProperty('acuerdoId') || req.body.hasOwnProperty('participantes'),
        acuerdoId || null,
        id,
        vivienda.id
      ]
    );

    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function eliminarGasto(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;

    const { rows: [gasto] } = await pool.query(
      'SELECT id, status FROM vivienda_gastos WHERE id::text = $1 AND vivienda_id = $2', [id, vivienda.id]
    );

    if (!gasto) {
      const err = new Error('Gasto no encontrado'); err.status = 404; return next(err);
    }

    if (gasto.status === 'PAGADO') {
      const err = new Error('No podés eliminar un gasto que ya figura como PAGADO. Revertí el pago primero para poder borrarlo.');
      err.status = 409;
      return next(err);
    }

    await pool.query('DELETE FROM vivienda_gastos WHERE id = $1 AND vivienda_id = $2', [gasto.id, vivienda.id]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

// ── Servicios periódicos ──────────────────────────────────────────────────────

async function listarServicios(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) return res.json({ ok: true, data: [] });

    const { rows: [usuario] } = await pool.query('SELECT name FROM usuarios WHERE id = $1', [req.user.id]);
    const userName = usuario ? usuario.name : '';

    const { rows } = await pool.query(
      `SELECT s.id::text, s.nombre, s.monto::float, s.periodicidad,
              s.proximo_vencimiento::text AS "proximoVencimiento",
              s.participantes, s.creado_en AS "creadoEn",
              s.is_variable AS "isVariable", s.status,
              s.acuerdo_id AS "acuerdoId",
              s.imagen_url AS "imagenUrl",
              COALESCE(ap.porcentaje, 0)::float AS "miPorcentaje"
       FROM vivienda_servicios s
       LEFT JOIN acuerdo_participantes ap ON ap.acuerdo_id = s.acuerdo_id AND LOWER(ap.nombre) = LOWER($2)
       WHERE s.vivienda_id = $1
       ORDER BY s.proximo_vencimiento`,
      [vivienda.id, userName]
    );

    const data = rows.map(r => {
      let miPorcentaje = r.miPorcentaje;
      // Fallback para servicios viejos sin acuerdo_id
      if (!r.acuerdoId && Array.isArray(r.participantes)) {
        const found = r.participantes.find(p => p.toLowerCase() === userName.toLowerCase());
        if (found) miPorcentaje = 100 / (r.participantes.length || 1);
      }
      return {
        ...r,
        monto_responsabilidad_usuario: r.monto ? (r.monto * miPorcentaje / 100) : 0
      };
    });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function crearServicio(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    let { acuerdoId, nombreServicio, frecuencia, proximoVencimiento, monto, isVariable = false, imagenUrl } = req.body;
    if (monto !== undefined) monto = limpiarMontoOCR(monto);

    if (!acuerdoId) {
      const err = new Error('Debes asociar un acuerdo válido');
      err.status = 400; return next(err);
    }
    if (!nombreServicio || !frecuencia || !proximoVencimiento) {
      const err = new Error('Faltan campos obligatorios para crear un servicio periódico.');
      err.status = 400; return next(err);
    }
    if (!isVariable && !monto) {
      const err = new Error('El monto es obligatorio para servicios de importe fijo.');
      err.status = 400; return next(err);
    }

    // Consultar tabla vivienda_acuerdos (participantes)
    const { rows: partRows } = await pool.query(
      'SELECT nombre, porcentaje FROM acuerdo_participantes WHERE acuerdo_id = $1',
      [acuerdoId]
    );
    const participantes = partRows.map(r => r.nombre);

    const montoFinal = isVariable ? null : Number(monto);
    const statusFinal = isVariable ? 'PENDIENTE' : 'PROCESADO';
    const id = uuidv4();

    await pool.query(
      `INSERT INTO vivienda_servicios (id, vivienda_id, nombre, monto, periodicidad, proximo_vencimiento, participantes, is_variable, status, acuerdo_id, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, vivienda.id, nombreServicio, montoFinal, frecuencia.toLowerCase(), proximoVencimiento, participantes, isVariable, statusFinal, acuerdoId, imagenUrl || null]
    );

    const { rows: [usuario] } = await pool.query('SELECT name FROM usuarios WHERE id = $1', [req.user.id]);
    const creatorName = usuario ? usuario.name : '';

    // Si es variable, notificamos para carga de monto (usamos .catch para no bloquear)
    if (isVariable && participantes.length > 0) {
      notifyUsersByName(
        participantes,
        {
          title: 'Nuevo servicio variable',
          body: `Servicio "${nombreServicio}" requiere actualización: ingrese el monto`,
          data: { type: 'variable_service_pending', servicioId: id, url: 'mitimiti://deudas' },
        },
        { category: NOTIFICATION_CATEGORIES.SERVICIO_VARIABLE }
      ).catch(e => console.error('Error al notificar servicio variable:', e));
    } else {
      // Notificación estándar asíncrona para participantes excluyendo al creador
      const fechaObj = new Date(proximoVencimiento);
      const formateador = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      const fechaLegible = formateador.format(fechaObj);

      partRows.forEach(part => {
        if (part.nombre.toLowerCase() !== creatorName.toLowerCase()) {
          notifyUsersByName(
            [part.nombre],
            {
              title: '🏠 Nuevo servicio en la vivienda',
              body: `Se ha creado ${nombreServicio}. La fecha límite de pago es el ${fechaLegible}.`,
              data: { type: 'nuevo_servicio', servicioId: id, url: 'mitimiti://deudas' }
            },
            { category: NOTIFICATION_CATEGORIES.NUEVOS_GASTOS }
          ).catch(e => console.error('Error al notificar nuevo servicio:', e));
        }
      });
    }

    res.status(201).json({
      ok: true,
      data: { id, nombre: nombreServicio, monto: montoFinal, periodicidad: frecuencia, proximoVencimiento, participantes, isVariable, status: statusFinal, acuerdoId, imagenUrl: imagenUrl || null },
    });
  } catch (err) {
    next(err);
  }
}

async function editarServicio(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;
    let { nombreServicio, monto, frecuencia, proximoVencimiento, isVariable, acuerdoId, imagenUrl } = req.body;
    if (monto !== undefined) monto = limpiarMontoOCR(monto);

    const { rows: [existing] } = await pool.query(
      'SELECT id, status, imagen_url FROM vivienda_servicios WHERE id = $1 AND vivienda_id = $2', [id, vivienda.id]
    );
    if (!existing) {
      const err = new Error('Servicio no encontrado'); err.status = 404; return next(err);
    }

    let participantesFinales = undefined;
    if (acuerdoId) {
      const { rows: partRows } = await pool.query(
        'SELECT nombre FROM acuerdo_participantes WHERE acuerdo_id = $1',
        [acuerdoId]
      );
      participantesFinales = partRows.map(r => r.nombre);
    }

    // Si cambia isVariable, actualizamos status
    const montoFinal = (isVariable === true) ? null : (monto != null ? Number(monto) : null);
    let statusFinal = undefined;
    if (isVariable !== undefined) {
      if (isVariable === true) {
        statusFinal = existing.status !== 'PAGADO' ? 'PENDIENTE' : 'PAGADO';
      } else {
        statusFinal = 'PROCESADO';
      }
    }

    const imagenUrlFinal = imagenUrl !== undefined ? imagenUrl : existing.imagen_url;

    const { rows: [updated] } = await pool.query(
      `UPDATE vivienda_servicios SET
         nombre = COALESCE($1, nombre),
         monto = $2,
         periodicidad = COALESCE($3, periodicidad),
         proximo_vencimiento = COALESCE($4, proximo_vencimiento),
         participantes = COALESCE($5, participantes),
         is_variable = COALESCE($6, is_variable),
         acuerdo_id = COALESCE($7, acuerdo_id),
         imagen_url = $8,
         status = COALESCE($9, status)
       WHERE id = $10 AND vivienda_id = $11
       RETURNING id::text, nombre, monto::float, periodicidad,
                 proximo_vencimiento::text AS "proximoVencimiento", participantes,
                 is_variable AS "isVariable", status, imagen_url AS "imagenUrl"`,
      [
        nombreServicio || null,
        montoFinal,
        frecuencia?.toLowerCase() || null,
        proximoVencimiento || null,
        participantesFinales || null,
        isVariable !== undefined ? isVariable : null,
        acuerdoId || null,
        imagenUrlFinal,
        statusFinal,
        id,
        vivienda.id
      ]
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

// ── Liquidar servicio variable ────────────────────────────────────────────────

async function liquidarServicio(req, res, next) {
  const client = await pool.connect();
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id } = req.params;
    let { monto, imagenUrl } = req.body;
    monto = limpiarMontoOCR(monto);

    // Validación server-side: monto debe ser un número positivo
    if (monto == null || typeof Number(monto) !== 'number' || isNaN(Number(monto)) || Number(monto) <= 0) {
      const err = new Error('El monto debe ser un número positivo.');
      err.status = 400; return next(err);
    }
    const montoReal = Number(monto);

    const { rows: [servicio] } = await client.query(
      `SELECT id, nombre, is_variable, status, participantes, periodicidad, imagen_url
       FROM vivienda_servicios
       WHERE id = $1 AND vivienda_id = $2`,
      [id, vivienda.id]
    );

    if (!servicio) {
      const err = new Error('Servicio no encontrado'); err.status = 404; return next(err);
    }
    if (!servicio.is_variable) {
      const err = new Error('Este servicio no es de importe variable.'); err.status = 400; return next(err);
    }
    if (servicio.status === 'PROCESADO' || servicio.status === 'PAGADO') {
      const err = new Error('Este servicio ya fue procesado en el ciclo actual.'); err.status = 409; return next(err);
    }

    // Transacción: actualizar servicio + crear gasto puntual
    await client.query('BEGIN');

    // 1. Actualizar el servicio a PROCESADO
    const { rows: [updated] } = await client.query(
      `UPDATE vivienda_servicios SET monto = $1, status = 'PROCESADO'
       WHERE id = $2
       RETURNING id::text, nombre, monto::float, periodicidad,
                 proximo_vencimiento::text AS "proximoVencimiento",
                 participantes, is_variable AS "isVariable", status, imagen_url AS "imagenUrl"`,
      [montoReal, id]
    );

    // 2. Crear un gasto puntual vinculado (impacto en balance/totalMes)
    const gastoId = uuidv4();
    const participantes = Array.isArray(servicio.participantes) ? servicio.participantes : [];
    const pagador = participantes[0] || 'Vivienda';
    const finalImagenUrl = imagenUrl || servicio.imagen_url;

    await client.query(
      `INSERT INTO vivienda_gastos (id, vivienda_id, nombre, monto, categoria, fecha, pagador, imagen_url, participantes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [gastoId, vivienda.id, `Liquidación: ${servicio.nombre}`, montoReal, 'Suscripciones',
        new Date().toISOString().split('T')[0], pagador, finalImagenUrl || null, participantes]
    );

    await client.query('COMMIT');

    // 3. Notificar a participantes
    if (participantes.length > 0) {
      await notifyUsersByName(
        participantes,
        {
          title: 'Servicio liquidado',
          body: `"${servicio.nombre}" fue liquidado por $${montoReal.toLocaleString('es-AR')}`,
          data: { type: 'variable_service_settled', servicioId: id, gastoId },
        },
        { category: NOTIFICATION_CATEGORIES.SERVICIO_VARIABLE }
      );
    }

    res.json({ ok: true, data: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    next(err);
  } finally {
    client.release();
  }
}

// ── Acuerdos de reparto ───────────────────────────────────────────────────────

async function listarAcuerdos(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaBase(req.user.id);
    if (!vivienda) return res.json({ ok: true, data: [] });

    const { rows: acuerdos } = await pool.query(
      'SELECT id, nombre, modelo FROM vivienda_acuerdos WHERE vivienda_id = $1 AND activo = true',
      [vivienda.id]
    );

    const resultado = await Promise.all(
      acuerdos.map(async (a) => {
        const { rows: participantes } = await pool.query(
          'SELECT nombre, porcentaje::float, sueldo::float FROM acuerdo_participantes WHERE acuerdo_id = $1',
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

async function marcarComoPagado(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { tipo, id } = req.params;

    if (!['gastos', 'servicios'].includes(tipo)) {
      const err = new Error('Tipo no válido'); err.status = 400; return next(err);
    }

    const tabla = tipo === 'gastos' ? 'vivienda_gastos' : 'vivienda_servicios';

    const { rows: [updated] } = await pool.query(
      `UPDATE ${tabla} SET status = 'PAGADO', fecha_pago = NOW() WHERE id::text = $1 AND vivienda_id = $2 RETURNING *`,
      [id, vivienda.id]
    );

    if (!updated) {
      const err = new Error('Registro no encontrado'); err.status = 404; return next(err);
    }

    const { rows: [usuario] } = await pool.query('SELECT name FROM usuarios WHERE id = $1', [req.user.id]);
    const deudorName = usuario ? usuario.name : 'Un usuario';

    if (tipo === 'gastos') {
      if (updated.pagador && updated.pagador.toLowerCase() !== deudorName.toLowerCase()) {
        notifyUsersByName(
          [updated.pagador],
          {
            title: '✅ Pago recibido',
            body: `${deudorName} ha marcado el gasto "${updated.nombre}" como pagado. ¡La deuda ha sido liquidada!`,
            data: { type: 'pago_recibido', gastoId: id, url: 'mitimiti://deudas' }
          },
          { category: NOTIFICATION_CATEGORIES.NUEVOS_GASTOS }
        ).catch(e => console.error('Error enviando push de liquidación:', e));
      }
    } else if (tipo === 'servicios') {
      const { rows: [{ creador_id }] } = await pool.query('SELECT creador_id FROM viviendas WHERE id = $1', [vivienda.id]);
      const { rows: creador } = await pool.query('SELECT name FROM usuarios WHERE id = $1', [creador_id]);

      let destinatarios = [];
      if (creador.length > 0 && creador[0].name.toLowerCase() !== deudorName.toLowerCase()) {
        destinatarios.push(creador[0].name);
      } else {
        destinatarios = Array.isArray(updated.participantes)
          ? updated.participantes.filter(p => p.toLowerCase() !== deudorName.toLowerCase())
          : [];
      }

      if (destinatarios.length > 0) {
        notifyUsersByName(
          destinatarios,
          {
            title: '✅ Pago recibido',
            body: `${deudorName} ha marcado el servicio "${updated.nombre}" como pagado. ¡La deuda ha sido liquidada!`,
            data: { type: 'pago_recibido', servicioId: id, url: 'mitimiti://deudas' }
          },
          { category: NOTIFICATION_CATEGORIES.NUEVOS_GASTOS }
        ).catch(e => console.error('Error enviando push de liquidación:', e));
      }
    }

    res.json({ ok: true, message: 'Marcado como pagado' });
  } catch (err) {
    next(err);
  }
}

async function revertirPago(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { tipo, id } = req.params;

    if (!['gastos', 'servicios'].includes(tipo)) {
      const err = new Error('Tipo no válido'); err.status = 400; return next(err);
    }

    const tabla = tipo === 'gastos' ? 'vivienda_gastos' : 'vivienda_servicios';

    // Al revertir, el estado vuelve a 'PROCESADO' y limpiamos la fecha de pago
    const { rows: [updated] } = await pool.query(
      `UPDATE ${tabla} SET status = 'PROCESADO', fecha_pago = NULL WHERE id::text = $1 AND vivienda_id = $2 RETURNING id::text`,
      [id, vivienda.id]
    );

    if (!updated) {
      const err = new Error('Registro no encontrado'); err.status = 404; return next(err);
    }

    res.json({ ok: true, message: 'Pago revertido' });
  } catch (err) {
    next(err);
  }
}

async function guardarAcuerdo(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { nombre, modelo, participantes } = req.body;
    const key = `${vivienda.id}_${slugify(nombre)}_${uuidv4()}`;

    await pool.query(
      `INSERT INTO vivienda_acuerdos (id, vivienda_id, nombre, modelo, activo) VALUES ($1, $2, $3, $4, true)`,
      [key, vivienda.id, nombre, modelo]
    );

    if (Array.isArray(participantes)) {
      for (const p of participantes) {
        await pool.query(
          'INSERT INTO acuerdo_participantes (acuerdo_id, nombre, porcentaje, sueldo) VALUES ($1, $2, $3, $4)',
          [key, p.nombre, p.porcentaje, p.sueldo !== undefined && p.sueldo !== null ? p.sueldo : null]
        );
      }
    }

    res.status(201).json({ ok: true, data: { id: key, nombre, modelo, participantes: participantes || [] } });
  } catch (err) {
    next(err);
  }
}

async function editarAcuerdo(req, res, next) {
  const client = await pool.connect();
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const { id: oldKey } = req.params;
    const { nombre, modelo, participantes } = req.body;

    // Check if the old agreement exists and belongs to the vivienda
    const { rows: [existing] } = await client.query(
      'SELECT id FROM vivienda_acuerdos WHERE id = $1 AND vivienda_id = $2',
      [oldKey, vivienda.id]
    );
    if (!existing) {
      const err = new Error('Acuerdo no encontrado');
      err.status = 404;
      return next(err);
    }

    await client.query('BEGIN');

    // 1. Mark the old agreement as inactive (soft delete)
    await client.query(
      'UPDATE vivienda_acuerdos SET activo = false WHERE id = $1',
      [oldKey]
    );

    // 2. Create the new agreement with a new unique key
    const newKey = `${vivienda.id}_${slugify(nombre)}_${uuidv4()}`;

    await client.query(
      `INSERT INTO vivienda_acuerdos (id, vivienda_id, nombre, modelo, activo)
       VALUES ($1, $2, $3, $4, true)`,
      [newKey, vivienda.id, nombre, modelo]
    );

    // 3. Insert the new participants and percentages
    if (Array.isArray(participantes)) {
      for (const p of participantes) {
        await client.query(
          'INSERT INTO acuerdo_participantes (acuerdo_id, nombre, porcentaje, sueldo) VALUES ($1, $2, $3, $4)',
          [newKey, p.nombre, p.porcentaje, p.sueldo !== undefined && p.sueldo !== null ? p.sueldo : null]
        );
      }
    }

    // 4. Update existing recurring services pointing to the old key
    const participanteNombres = Array.isArray(participantes) ? participantes.map(p => p.nombre) : [];
    await client.query(
      `UPDATE vivienda_servicios
       SET acuerdo_id = $1, participantes = $2
       WHERE acuerdo_id = $3 AND vivienda_id = $4`,
      [newKey, participanteNombres, oldKey, vivienda.id]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      data: {
        id: newKey,
        nombre,
        modelo,
        participantes: participantes || []
      }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    next(err);
  } finally {
    client.release();
  }
}

async function eliminarAcuerdo(req, res, next) {
  try {
    const vivienda = await obtenerMiViviendaOrFail(req);
    const id = req.params.id.trim();
    const { rowCount } = await pool.query(
      'UPDATE vivienda_acuerdos SET activo = false WHERE id = $1 AND vivienda_id = $2',
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
  listarGastos, crearGasto, editarGasto, eliminarGasto,
  listarServicios, crearServicio, editarServicio, eliminarServicio, liquidarServicio,
  listarAcuerdos, guardarAcuerdo, editarAcuerdo, eliminarAcuerdo,
  marcarComoPagado, revertirPago,
};
