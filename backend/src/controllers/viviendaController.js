const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');

const DB_PATH = path.join(__dirname, '../../data/db.json');

function leerDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function escribirDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function asegurarEstructuraVivienda(db) {
  if (!db.vivienda || typeof db.vivienda !== 'object') {
    db.vivienda = {};
  }
  if (!Array.isArray(db.vivienda.gastos)) {
    db.vivienda.gastos = [];
  }
  if (!Array.isArray(db.vivienda.serviciosPeriodicos)) {
    db.vivienda.serviciosPeriodicos = [];
  }
  if (!db.vivienda.acuerdosReparto || typeof db.vivienda.acuerdosReparto !== 'object') {
    db.vivienda.acuerdosReparto = {};
  }
}

function listarGastos(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    res.json({ ok: true, data: db.vivienda.gastos });
  } catch (err) {
    next(err);
  }
}

function crearGasto(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    const { nombre, monto, categoria, fecha, pagador, participantes } = req.body;

    if (!nombre || !monto || !categoria || !fecha || !pagador) {
      const err = new Error('Faltan campos obligatorios para crear un gasto.');
      err.status = 400;
      return next(err);
    }

    const nuevo = {
      id: uuidv4(),
      nombre,
      monto: Number(monto),
      categoria,
      fecha,
      pagador,
      participantes: participantes || []
    };

    db.vivienda.gastos.push(nuevo);
    escribirDB(db);

    res.status(201).json({ ok: true, data: nuevo });
  } catch (err) {
    next(err);
  }
}

function listarServicios(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    res.json({ ok: true, data: db.vivienda.serviciosPeriodicos });
  } catch (err) {
    next(err);
  }
}

function crearServicio(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    const { nombre, monto, periodicidad, proximoVencimiento, participantes } = req.body;

    if (!nombre || !monto || !periodicidad || !proximoVencimiento) {
      const err = new Error('Faltan campos obligatorios para crear un servicio periódico.');
      err.status = 400;
      return next(err);
    }

    const nuevo = {
      id: uuidv4(),
      nombre,
      monto: Number(monto),
      periodicidad,
      proximoVencimiento,
      participantes: participantes || []
    };

    db.vivienda.serviciosPeriodicos.push(nuevo);
    escribirDB(db);

    res.status(201).json({ ok: true, data: nuevo });
  } catch (err) {
    next(err);
  }
}

function editarGasto(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    const { id } = req.params;
    const { nombre, monto, categoria, fecha, pagador, participantes } = req.body;
    
    const idx = db.vivienda.gastos.findIndex(g => g.id === id);
    if (idx === -1) {
      const err = new Error('Gasto no encontrado');
      err.status = 404;
      return next(err);
    }
    
    const actualizado = {
      ...db.vivienda.gastos[idx],
      nombre: nombre || db.vivienda.gastos[idx].nombre,
      monto: monto !== undefined ? Number(monto) : db.vivienda.gastos[idx].monto,
      categoria: categoria || db.vivienda.gastos[idx].categoria,
      fecha: fecha || db.vivienda.gastos[idx].fecha,
      pagador: pagador || db.vivienda.gastos[idx].pagador,
      participantes: participantes || db.vivienda.gastos[idx].participantes
    };
    
    db.vivienda.gastos[idx] = actualizado;
    escribirDB(db);
    
    res.json({ ok: true, data: actualizado });
  } catch (err) {
    next(err);
  }
}

function editarServicio(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    const { id } = req.params;
    const { nombre, monto, periodicidad, proximoVencimiento, participantes } = req.body;
    
    const idx = db.vivienda.serviciosPeriodicos.findIndex(s => s.id === id);
    if (idx === -1) {
      const err = new Error('Servicio no encontrado');
      err.status = 404;
      return next(err);
    }
    
    const actualizado = {
      ...db.vivienda.serviciosPeriodicos[idx],
      nombre: nombre || db.vivienda.serviciosPeriodicos[idx].nombre,
      monto: monto !== undefined ? Number(monto) : db.vivienda.serviciosPeriodicos[idx].monto,
      periodicidad: periodicidad || db.vivienda.serviciosPeriodicos[idx].periodicidad,
      proximoVencimiento: proximoVencimiento || db.vivienda.serviciosPeriodicos[idx].proximoVencimiento,
      participantes: participantes || db.vivienda.serviciosPeriodicos[idx].participantes
    };
    
    db.vivienda.serviciosPeriodicos[idx] = actualizado;
    escribirDB(db);
    
    res.json({ ok: true, data: actualizado });
  } catch (err) {
    next(err);
  }
}

function eliminarServicio(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    const { id } = req.params;

    const idx = db.vivienda.serviciosPeriodicos.findIndex(s => s.id === id);
    if (idx === -1) {
      const err = new Error('Servicio no encontrado');
      err.status = 404;
      return next(err);
    }

    const eliminado = db.vivienda.serviciosPeriodicos[idx];
    db.vivienda.serviciosPeriodicos.splice(idx, 1);
    escribirDB(db);

    res.json({ ok: true, data: eliminado });
  } catch (err) {
    next(err);
  }
}

//NURVO//

function listarAcuerdos(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    const acuerdosObj = db.vivienda.acuerdosReparto;
    // Convertimos el objeto a array para que el frontend lo maneje fácil
    const acuerdosArray = Object.values(acuerdosObj);
    res.json({ ok: true, data: acuerdosArray });
  } catch (err) { next(err); }
}

function guardarAcuerdo(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    
    const { nombre, modelo, participantes } = req.body;
    
    // --- ESTE ES EL CAMBIO CLAVE ---
    // Limpiamos el nombre para usarlo como clave única en el objeto
    const key = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    db.vivienda.acuerdosReparto[key] = { id: key, nombre, modelo, participantes };
    escribirDB(db);
    
    res.status(201).json({ ok: true, data: db.vivienda.acuerdosReparto[key] });
  } catch (err) { next(err); }
}

function eliminarAcuerdo(req, res, next) {
  try {
    const db = leerDB();
    asegurarEstructuraVivienda(db);
    // Normalizamos el ID que viene de la URL para que sea igual a como lo guardaste
    const id = req.params.id.toLowerCase().trim();
    
    console.log("Buscando en DB el ID:", id); // Para ver qué está buscando

    if (db.vivienda.acuerdosReparto[id]) {
      delete db.vivienda.acuerdosReparto[id];
      escribirDB(db);
      return res.status(200).json({ ok: true, message: "Eliminado" });
    } else {
      // Si no existe, imprime las claves disponibles para que sepas qué está pasando
      console.log("Claves disponibles:", Object.keys(db.vivienda.acuerdosReparto));
      return res.status(404).json({ ok: false, message: "ID no encontrado" });
    }
  } catch (err) { next(err); }
}
module.exports = { listarGastos, crearGasto, editarGasto, listarServicios, crearServicio, editarServicio, eliminarServicio, listarAcuerdos, guardarAcuerdo, eliminarAcuerdo };


