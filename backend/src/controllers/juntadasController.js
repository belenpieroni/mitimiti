/**
 * juntadasController.js
 * ──────────────────────
 * Controlador REST para el módulo Juntadas (MVP E1).
 *
 * Persistencia: archivo JSON (data/db.json).
 * No se requiere base de datos para el MVP — el archivo actúa como store
 * simple y es suficiente para el alcance de la Entrega 1.
 * En E2 se migrará a una DB real (SQLite o Firebase).
 *
 * Endpoints implementados:
 *   GET    /api/juntadas                            → listar todas
 *   POST   /api/juntadas                            → crear
 *   GET    /api/juntadas/:id                        → obtener una
 *   DELETE /api/juntadas/:id                        → eliminar
 *
 *   POST   /api/juntadas/:id/participantes          → agregar participante
 *   DELETE /api/juntadas/:id/participantes/:pid     → quitar participante
 *
 *   POST   /api/juntadas/:id/gastos                 → agregar gasto
 *   DELETE /api/juntadas/:id/gastos/:gid            → eliminar gasto
 *
 *   GET    /api/juntadas/:id/balance                → balance calculado
 *   GET    /api/balance/global/:nombre              → balance global por participante
 */

const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const { calcularBalance, calcularBalanceGlobal } = require('../services/balanceService');

const DB_PATH = path.join(__dirname, '../../data/db.json');

// ── Helpers de persistencia ───────────────────────────────────────────────────

function leerDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function escribirDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── Helpers de colores para participantes ─────────────────────────────────────

const COLORES_DISPONIBLES = [
  '#473472', '#526D82', '#9DB2BF', '#42b271',
  '#c084fc', '#f97316', '#ec6c6a', '#38bdf8',
];

function getIniciales(nombre) {
  const partes = nombre.trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

// ── Controladores ─────────────────────────────────────────────────────────────

/**
 * GET /api/juntadas
 * Devuelve la lista de todas las juntadas con un resumen del balance.
 */
function listarJuntadas(req, res, next) {
  try {
    const db = leerDB();

    const resultado = db.juntadas.map((j) => {
      const balance = calcularBalance(j);
      // Calculamos el saldo del "usuario actual" (Martín por defecto en MVP sin auth)
      // En E2 esto vendrá del token de autenticación
      const saldoUsuario = balance.saldos.find((s) => s.nombre === 'Martín');
      return {
        id: j.id,
        nombre: j.nombre,
        descripcion: j.descripcion,
        fecha: j.fecha,
        cantidadParticipantes: j.participantes.length,
        cantidadGastos: j.gastos.length,
        totalGastado: balance.totalGastado,
        participantes: j.participantes,
        // Info de deuda para el usuario actual
        deuda: saldoUsuario ? Math.abs(saldoUsuario.saldo) : 0,
        tipo: saldoUsuario
          ? saldoUsuario.saldo > 0.01
            ? 'cobrar'
            : saldoUsuario.saldo < -0.01
            ? 'pagar'
            : 'ninguna'
          : 'ninguna',
      };
    });

    res.json({ ok: true, data: resultado });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/juntadas
 * Body: { nombre, descripcion?, participantes: [{ nombre, iniciales?, color? }] }
 */
function crearJuntada(req, res, next) {
  try {
    const { nombre, descripcion = '', participantes = [] } = req.body;

    if (!nombre || nombre.trim() === '') {
      const err = new Error('El campo "nombre" es requerido.');
      err.status = 400;
      return next(err);
    }

    if (!Array.isArray(participantes) || participantes.length === 0) {
      const err = new Error('Se requiere al menos un participante.');
      err.status = 400;
      return next(err);
    }

    const nuevosParticipantes = participantes.map((p, i) => ({
      id: uuidv4(),
      nombre: p.nombre.trim(),
      iniciales: p.iniciales || getIniciales(p.nombre),
      color: p.color || COLORES_DISPONIBLES[i % COLORES_DISPONIBLES.length],
    }));

    const nueva = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fecha: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      creadaEn: new Date().toISOString(),
      participantes: nuevosParticipantes,
      gastos: [],
      subgrupos: [],
    };

    const db = leerDB();
    db.juntadas.unshift(nueva); // más reciente primero
    escribirDB(db);

    res.status(201).json({ ok: true, data: nueva });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/juntadas/:id
 * Devuelve la juntada completa con el balance calculado incluido.
 */
function obtenerJuntada(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);

    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    const balance = calcularBalance(juntada);
    
    if (db.perfiles) {
      balance.transferencias = balance.transferencias.map(t => ({
        ...t,
        aliasDestino: db.perfiles[t.para] ? db.perfiles[t.para].alias : null
      }));
    }

    res.json({ ok: true, data: { ...juntada, balance } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/juntadas/:id
 */
function editarJuntada(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);
    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }
    const { nombre, descripcion } = req.body;
    if (nombre !== undefined) juntada.nombre = nombre.trim();
    if (descripcion !== undefined) juntada.descripcion = descripcion.trim();
    escribirDB(db);
    res.json({ ok: true, data: juntada });
  } catch (err) {
    next(err);
  }
}

function eliminarJuntada(req, res, next) {
  try {
    const db = leerDB();
    const index = db.juntadas.findIndex((j) => j.id === req.params.id);

    if (index === -1) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    db.juntadas.splice(index, 1);
    escribirDB(db);

    res.json({ ok: true, mensaje: 'Juntada eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
}

// ── Participantes ─────────────────────────────────────────────────────────────

/**
 * POST /api/juntadas/:id/participantes
 * Body: { nombre, iniciales?, color? }
 */
function agregarParticipante(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);

    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    const { nombre, iniciales, color } = req.body;
    if (!nombre || nombre.trim() === '') {
      const err = new Error('El campo "nombre" del participante es requerido.');
      err.status = 400;
      return next(err);
    }

    const nombreLimpio = nombre.trim();

    // Validar duplicado
    const yaExiste = juntada.participantes.some(
      (p) => p.nombre.toLowerCase() === nombreLimpio.toLowerCase()
    );
    if (yaExiste) {
      const err = new Error(`El participante "${nombreLimpio}" ya está en esta juntada.`);
      err.status = 409;
      return next(err);
    }

    const colorAsignado =
      color || COLORES_DISPONIBLES[juntada.participantes.length % COLORES_DISPONIBLES.length];

    const nuevo = {
      id: uuidv4(),
      nombre: nombreLimpio,
      iniciales: iniciales || getIniciales(nombreLimpio),
      color: colorAsignado,
    };

    juntada.participantes.push(nuevo);
    escribirDB(db);

    res.status(201).json({ ok: true, data: nuevo });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/juntadas/:id/participantes/:pid
 */
function quitarParticipante(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);

    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    const index = juntada.participantes.findIndex((p) => p.id === req.params.pid);
    if (index === -1) {
      const err = new Error(`Participante con id "${req.params.pid}" no encontrado.`);
      err.status = 404;
      return next(err);
    }

    // Regla de negocio: no se puede quitar si tiene gastos registrados a su nombre
    const participante = juntada.participantes[index];
    const tieneGastos = juntada.gastos.some((g) => g.pagador === participante.nombre);
    if (tieneGastos) {
      const err = new Error(
        `No se puede quitar a "${participante.nombre}" porque tiene gastos registrados en esta juntada.`
      );
      err.status = 422;
      return next(err);
    }

    juntada.participantes.splice(index, 1);
    escribirDB(db);

    res.json({ ok: true, mensaje: `Participante "${participante.nombre}" eliminado.` });
  } catch (err) {
    next(err);
  }
}

// ── Gastos ────────────────────────────────────────────────────────────────────

/**
 * POST /api/juntadas/:id/gastos
 * Body: { nombre, pagador, monto }
 */
function agregarGasto(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);

    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    const { nombre, pagador, monto, splitMode = 'equal', splitSubgroups = [], ticketPhoto = null } = req.body;

    // Validaciones
    if (!nombre || nombre.trim() === '') {
      const err = new Error('El campo "nombre" del gasto es requerido.');
      err.status = 400;
      return next(err);
    }
    if (!pagador || pagador.trim() === '') {
      const err = new Error('El campo "pagador" es requerido.');
      err.status = 400;
      return next(err);
    }
    if (typeof monto !== 'number' || monto <= 0) {
      const err = new Error('El campo "monto" debe ser un número mayor a 0.');
      err.status = 400;
      return next(err);
    }

    // Validar que el pagador sea un participante de la juntada
    const esParticipante = juntada.participantes.some(
      (p) => p.nombre.toLowerCase() === pagador.trim().toLowerCase()
    );
    if (!esParticipante) {
      const err = new Error(
        `"${pagador}" no es un participante de esta juntada. Agregalo primero.`
      );
      err.status = 422;
      return next(err);
    }

    const nuevo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      pagador: pagador.trim(),
      splitMode,     
      splitSubgroups, 
      monto: Math.round(monto * 100) / 100, // redondear a 2 decimales
      ticketPhoto,   // URL de la foto del ticket (null si se cargó manual)
      creadoEn: new Date().toISOString(),
    };

    juntada.gastos.push(nuevo);
    escribirDB(db);

    res.status(201).json({ ok: true, data: nuevo });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/juntadas/:id/gastos/:gid
 */
function eliminarGasto(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);

    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    const index = juntada.gastos.findIndex((g) => g.id === req.params.gid);
    if (index === -1) {
      const err = new Error(`Gasto con id "${req.params.gid}" no encontrado.`);
      err.status = 404;
      return next(err);
    }

    juntada.gastos.splice(index, 1);
    escribirDB(db);

    res.json({ ok: true, mensaje: 'Gasto eliminado correctamente.' });
  } catch (err) {
    next(err);
  }
}

// ── Balance ───────────────────────────────────────────────────────────────────

/**
 * GET /api/juntadas/:id/balance
 * Devuelve el balance calculado para una juntada específica.
 */
function obtenerBalance(req, res, next) {
  try {
    const db = leerDB();
    const juntada = db.juntadas.find((j) => j.id === req.params.id);

    if (!juntada) {
      const err = new Error(`Juntada con id "${req.params.id}" no encontrada.`);
      err.status = 404;
      return next(err);
    }

    const balance = calcularBalance(juntada);
    
    if (db.perfiles) {
      balance.transferencias = balance.transferencias.map(t => ({
        ...t,
        aliasDestino: db.perfiles[t.para] ? db.perfiles[t.para].alias : null
      }));
    }

    res.json({ ok: true, data: balance });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/balance/global/:nombre
 * Devuelve el balance consolidado de un participante en TODAS sus juntadas.
 * Útil para el HomeScreen.
 */
function obtenerBalanceGlobal(req, res, next) {
  try {
    const db = leerDB();
    const nombre = decodeURIComponent(req.params.nombre);
    const balance = calcularBalanceGlobal(nombre, db.juntadas);
    res.json({ ok: true, data: balance });
  } catch (err) {
    next(err);
  }
}

const agregarSubgrupo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, integrantes } = req.body;

    // Validación del CA1: Mínimo 2 participantes
    if (!nombre || !integrantes || integrantes.length < 2) {
      return res.status(400).json({ error: 'El subgrupo debe tener un nombre y al menos 2 integrantes.' });
    }

    const data = leerDB();
    const juntada = data.juntadas.find(j => j.id === id);

    if (!juntada) return res.status(404).json({ error: 'Juntada no encontrada' });

    // Si por ser una juntada vieja no tiene el array, se lo creamos
    if (!juntada.subgrupos) juntada.subgrupos = [];

    const nuevoSubgrupo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      integrantes
    };

    juntada.subgrupos.push(nuevoSubgrupo);
    escribirDB(data);

    res.status(201).json({ ok: true, data: nuevoSubgrupo });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear el subgrupo' });
  }
};

const editarSubgrupo = async (req, res) => {
  try {
    const { id, sgid } = req.params;
    const { nombre, integrantes } = req.body;

    if (!nombre || !integrantes || integrantes.length < 2) {
      return res.status(400).json({ error: 'El subgrupo debe tener un nombre y al menos 2 integrantes.' });
    }

    const data = leerDB();
    const juntada = data.juntadas.find(j => j.id === id);
    if (!juntada) return res.status(404).json({ error: 'Juntada no encontrada' });

    const sg = (juntada.subgrupos || []).find(s => s.id === sgid);
    if (!sg) return res.status(404).json({ error: 'Subgrupo no encontrado' });

    sg.nombre = nombre.trim();
    sg.integrantes = integrantes;
    escribirDB(data);

    res.json({ ok: true, data: sg });
  } catch (error) {
    res.status(500).json({ error: 'Error al editar el subgrupo' });
  }
};

const eliminarSubgrupo = async (req, res) => {
  try {
    const { id, sgid } = req.params;

    const data = leerDB();
    const juntada = data.juntadas.find(j => j.id === id);

    if (!juntada) return res.status(404).json({ error: 'Juntada no encontrada' });
    if (!juntada.subgrupos) juntada.subgrupos = [];

    const indiceSg = juntada.subgrupos.findIndex(sg => sg.id === sgid);
    if (indiceSg === -1) return res.status(404).json({ error: 'Subgrupo no encontrado' });

    juntada.subgrupos.splice(indiceSg, 1);
    escribirDB(data);

    res.status(200).json({ ok: true, mensaje: 'Subgrupo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el subgrupo' });
  }
};

module.exports = {
  listarJuntadas,
  crearJuntada,
  editarJuntada,
  obtenerJuntada,
  eliminarJuntada,
  agregarParticipante,
  quitarParticipante,
  agregarGasto,
  eliminarGasto,
  obtenerBalance,
  obtenerBalanceGlobal,
  agregarSubgrupo,
  editarSubgrupo,
  eliminarSubgrupo,
};