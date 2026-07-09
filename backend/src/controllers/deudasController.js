const { randomUUID: uuidv4 } = require('crypto');
const { pool } = require('../db');
const { cargarJuntadaCompleta } = require('../helpers/juntadaHelpers');
const { calcularBalance } = require('../services/balanceService');

// Genera un ID codificado que lleva la info necesaria para registrar el pago
function encodeConceptoId(juntadaId, de, para, monto) {
  return Buffer.from(`${juntadaId}|${de}|${para}|${monto}`).toString('base64url');
}

function decodeConceptoId(id) {
  try {
    const str = Buffer.from(id, 'base64url').toString('utf8');
    const [juntadaId, de, para, monto] = str.split('|');
    return { juntadaId, de, para, monto: Number(monto) };
  } catch {
    return null;
  }
}

function getIniciales(nombre) {
  const partes = (nombre || '').trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (nombre || '??').slice(0, 2).toUpperCase();
}

async function getConsolidado(req, res, next) {
  try {
    const usuario = req.params.usuarioNombre
      ? decodeURIComponent(req.params.usuarioNombre)
      : req.query.usuario;
    if (!usuario)
      return res.status(400).json({ ok: false, error: 'El parámetro "usuario" es requerido.' });

    const { rows: ids } = await pool.query(
      `SELECT DISTINCT j.id::text
       FROM juntadas j
       JOIN juntada_participantes p ON p.juntada_id = j.id
       WHERE LOWER(p.nombre) = LOWER($1)`,
      [usuario]
    );

    // Mapa: acreedor -> { nombre, totalAcreedor, conceptos[] }
    const acreedoresMap = new Map();

    for (const { id } of ids) {
      const juntada = await cargarJuntadaCompleta(id);
      const balance = calcularBalance(juntada);

      for (const t of balance.transferencias) {
        // Solo incluir deudas donde el usuario ES el deudor (t.de)
        if (t.de.toLowerCase() !== usuario.toLowerCase()) continue;

        const acreedorKey = t.para.toLowerCase();
        if (!acreedoresMap.has(acreedorKey)) {
          acreedoresMap.set(acreedorKey, {
            id: acreedorKey,
            nombre: t.para,
            avatar: getIniciales(t.para),
            totalAcreedor: 0,
            conceptos: [],
          });
        }

        const acreedor = acreedoresMap.get(acreedorKey);
        acreedor.totalAcreedor = Math.round((acreedor.totalAcreedor + t.monto) * 100) / 100;
        acreedor.conceptos.push({
          id: encodeConceptoId(juntada.id, t.de, t.para, t.monto),
          titulo: juntada.nombre,
          sub: 'Juntada',
          tipo: 'Juntada',
          monto: t.monto,
        });
      }
    }

    res.json({ ok: true, data: Array.from(acreedoresMap.values()) });
  } catch (err) {
    next(err);
  }
}

async function pagarDeuda(req, res, next) {
  try {
    // Soporta tanto PATCH /pagar/:deudaId (frontend actual)
    // como body { juntadaId, de, para, monto } para uso futuro
    let juntadaId, de, para, monto;

    if (req.params.deudaId) {
      const decoded = decodeConceptoId(req.params.deudaId);
      if (!decoded) {
        return res.status(400).json({ ok: false, error: 'ID de deuda inválido.' });
      }
      ({ juntadaId, de, para, monto } = decoded);
    } else {
      ({ juntadaId, de, para, monto } = req.body);
    }

    if (!juntadaId || !de || !para || !monto)
      return res.status(400).json({ ok: false, error: 'Faltan datos: juntadaId, de, para, monto.' });

    const { rows: [juntada] } = await pool.query('SELECT id FROM juntadas WHERE id = $1', [juntadaId]);
    if (!juntada) return res.status(404).json({ ok: false, error: 'Juntada no encontrada.' });

    const id = uuidv4();
    const fecha = new Date().toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO juntada_pagos_deudas (id, juntada_id, de, para, monto, fecha)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, juntadaId, de, para, Number(monto), fecha]
    );

    res.status(201).json({ ok: true, data: { id, juntadaId, de, para, monto: Number(monto), fecha } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getConsolidado, pagarDeuda };
