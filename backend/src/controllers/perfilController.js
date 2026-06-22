const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/db.json');

function leerDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function escribirDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function obtenerPerfil(req, res, next) {
  try {
    const db = leerDB();
    const nombre = decodeURIComponent(req.params.nombre);
    const perfiles = db.perfiles || {};
    const perfil = perfiles[nombre] || { alias: '' };
    res.json({ ok: true, data: perfil });
  } catch (err) {
    next(err);
  }
}

function actualizarPerfil(req, res, next) {
  try {
    const db = leerDB();
    const nombre = decodeURIComponent(req.params.nombre);
    const { alias } = req.body;

    // Validación de alias
    if (!alias || alias.trim() === '') {
      const err = new Error('No podés guardar un Alias/CBU vacío. Usá el botón de eliminar si querés borrarlo.');
      err.status = 400;
      return next(err);
    }

    const aliasLimpio = alias.trim().toLowerCase();
    const aliasRegex = /^[a-z0-9.-]{6,22}$/;
    if (!aliasRegex.test(aliasLimpio)) {
      const err = new Error('El Alias/CBU debe tener entre 6 y 22 caracteres y solo contener minúsculas, números, guiones medios y puntos.');
      err.status = 400;
      return next(err);
    }

    if (!db.perfiles) {
      db.perfiles = {};
    }

    db.perfiles[nombre] = { alias: aliasLimpio };
    escribirDB(db);

    res.json({ ok: true, data: db.perfiles[nombre] });
  } catch (err) {
    next(err);
  }
}

function eliminarPerfil(req, res, next) {
  try {
    const db = leerDB();
    const nombre = decodeURIComponent(req.params.nombre);

    if (!db.perfiles) {
      db.perfiles = {};
    }

    db.perfiles[nombre] = { alias: '' };
    escribirDB(db);

    res.json({ ok: true, mensaje: 'Alias eliminado correctamente.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { obtenerPerfil, actualizarPerfil, eliminarPerfil };