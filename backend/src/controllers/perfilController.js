const { pool } = require('../db');

async function obtenerPerfil(req, res, next) {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const { rows } = await pool.query('SELECT nombre, alias FROM perfiles WHERE nombre = $1', [nombre]);
    const perfil = rows.length ? rows[0] : { alias: '' };
    res.json({ ok: true, data: perfil });
  } catch (err) {
    next(err);
  }
}

async function actualizarPerfil(req, res, next) {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const { alias } = req.body;

    if (!alias || alias.trim() === '') {
      const err = new Error('No podés guardar un Alias/CBU vacío. Usá el botón de eliminar si querés borrarlo.');
      err.status = 400; return next(err);
    }

    const aliasLimpio = alias.trim().toLowerCase();
    const aliasRegex = /^[a-z0-9.-]{6,22}$/;
    if (!aliasRegex.test(aliasLimpio)) {
      const err = new Error('El Alias/CBU debe tener entre 6 y 22 caracteres y solo contener minúsculas, números, guiones medios y puntos.');
      err.status = 400; return next(err);
    }

    await pool.query(
      `INSERT INTO perfiles (nombre, alias) VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET alias = $2`,
      [nombre, aliasLimpio]
    );

    res.json({ ok: true, data: { alias: aliasLimpio } });
  } catch (err) {
    next(err);
  }
}

async function eliminarPerfil(req, res, next) {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    await pool.query(
      `INSERT INTO perfiles (nombre, alias) VALUES ($1, '')
       ON CONFLICT (nombre) DO UPDATE SET alias = ''`,
      [nombre]
    );
    res.json({ ok: true, mensaje: 'Alias eliminado correctamente.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { obtenerPerfil, actualizarPerfil, eliminarPerfil };
