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

function listarGastos(req, res, next) {
  try {
    const db = leerDB();
    const vivienda = db.vivienda || { gastos: [], serviciosPeriodicos: [] };
    res.json({ ok: true, data: vivienda.gastos });
  } catch (err) {
    next(err);
  }
}

function crearGasto(req, res, next) {
  try {
    const db = leerDB();
    if (!db.vivienda) {
      db.vivienda = { gastos: [], serviciosPeriodicos: [] };
    }
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
    const vivienda = db.vivienda || { gastos: [], serviciosPeriodicos: [] };
    res.json({ ok: true, data: vivienda.serviciosPeriodicos });
  } catch (err) {
    next(err);
  }
}

function crearServicio(req, res, next) {
  try {
    const db = leerDB();
    if (!db.vivienda) {
      db.vivienda = { gastos: [], serviciosPeriodicos: [] };
    }
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
    if (!db.vivienda) db.vivienda = { gastos: [], serviciosPeriodicos: [] };
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
    if (!db.vivienda) db.vivienda = { gastos: [], serviciosPeriodicos: [] };
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

module.exports = {
  listarGastos,
  crearGasto,
  editarGasto,
  listarServicios,
  crearServicio,
  editarServicio
};
