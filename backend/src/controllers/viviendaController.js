const { randomUUID: uuidv4 } = require('crypto');
const { pool } = require('../db');

// ── Gastos ────────────────────────────────────────────────────────────────────

async function listarGastos(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id::text, nombre, monto::float, categoria, fecha::text, pagador,
              imagen_url AS "imagenUrl", participantes, creado_en AS "creadoEn"
       FROM vivienda_gastos ORDER BY fecha DESC, creado_en DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function crearGasto(req, res, next) {
  try {
    const { nombre, monto, categoria, fecha, pagador, participantes = [], imagenUrl } = req.body;

    if (!nombre || !monto || !categoria || !fecha || !pagador) {
      const err = new Error('Faltan campos obligatorios para crear un gasto.');
      err.status = 400; return next(err);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO vivienda_gastos (id, nombre, monto, categoria, fecha, pagador, imagen_url, participantes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, nombre, Number(monto), categoria, fecha, pagador, imagenUrl || null, participantes]
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
    const { id } = req.params;
    const { nombre, monto, categoria, fecha, pagador, participantes, imagenUrl } = req.body;

    const { rows: [existing] } = await pool.query(
      'SELECT id FROM vivienda_gastos WHERE id = $1', [id]
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
       WHERE id = $8
       RETURNING id::text, nombre, monto::float, categoria, fecha::text, pagador,
                 imagen_url AS "imagenUrl", participantes`,
      [nombre || null, monto != null ? Number(monto) : null, categoria || null,
       fecha || null, pagador || null, participantes || null, imagenUrl || null, id]
    );

    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Servicios periódicos ──────────────────────────────────────────────────────

async function listarServicios(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id::text, nombre, monto::float, periodicidad,
              proximo_vencimiento::text AS "proximoVencimiento",
              participantes, creado_en AS "creadoEn"
       FROM vivienda_servicios ORDER BY proximo_vencimiento`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function crearServicio(req, res, next) {
  try {
    const { nombre, monto, periodicidad, proximoVencimiento, participantes = [] } = req.body;

    if (!nombre || !monto || !periodicidad || !proximoVencimiento) {
      const err = new Error('Faltan campos obligatorios para crear un servicio periódico.');
      err.status = 400; return next(err);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO vivienda_servicios (id, nombre, monto, periodicidad, proximo_vencimiento, participantes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, nombre, Number(monto), periodicidad, proximoVencimiento, participantes]
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
    const { id } = req.params;
    const { nombre, monto, periodicidad, proximoVencimiento, participantes } = req.body;

    const { rows: [existing] } = await pool.query(
      'SELECT id FROM vivienda_servicios WHERE id = $1', [id]
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
       WHERE id = $6
       RETURNING id::text, nombre, monto::float, periodicidad,
                 proximo_vencimiento::text AS "proximoVencimiento", participantes`,
      [nombre || null, monto != null ? Number(monto) : null, periodicidad || null,
       proximoVencimiento || null, participantes || null, id]
    );

    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function eliminarServicio(req, res, next) {
  try {
    const { id } = req.params;

    const normalizar = (txt = '') =>
      String(txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Buscar por UUID exacto primero, luego por nombre normalizado como fallback legacy
    let { rows: [servicio] } = await pool.query(
      'SELECT id FROM vivienda_servicios WHERE id::text = $1', [id]
    );

    if (!servicio) {
      const { rows } = await pool.query('SELECT id, nombre FROM vivienda_servicios');
      const match = rows.find((s) => normalizar(s.nombre) === normalizar(id));
      if (match) servicio = match;
    }

    if (!servicio) {
      const err = new Error('Servicio no encontrado'); err.status = 404; return next(err);
    }

    await pool.query('DELETE FROM vivienda_servicios WHERE id = $1', [servicio.id]);
    res.json({ ok: true, data: servicio });
  } catch (err) {
    next(err);
  }
}

// ── Acuerdos de reparto ───────────────────────────────────────────────────────

async function listarAcuerdos(req, res, next) {
  try {
    const { rows: acuerdos } = await pool.query(
      'SELECT id, nombre, modelo FROM vivienda_acuerdos'
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
    const { nombre, modelo, participantes } = req.body;
    const key = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');

    await pool.query(
      `INSERT INTO vivienda_acuerdos (id, nombre, modelo) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET nombre = $2, modelo = $3`,
      [key, nombre, modelo]
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
    const id = req.params.id.toLowerCase().trim();
    const { rowCount } = await pool.query('DELETE FROM vivienda_acuerdos WHERE id = $1', [id]);

    if (rowCount === 0)
      return res.status(404).json({ ok: false, message: 'ID no encontrado' });

    res.status(200).json({ ok: true, message: 'Eliminado' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarGastos, crearGasto, editarGasto,
  listarServicios, crearServicio, editarServicio, eliminarServicio,
  listarAcuerdos, guardarAcuerdo, eliminarAcuerdo,
};
