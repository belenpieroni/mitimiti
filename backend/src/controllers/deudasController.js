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

    // 1. Cargar Juntadas (Pendientes y Pagos)
    const acreedoresMap = new Map();
    const pagosRecientes = [];

    const { rows: juntadasPagos } = await pool.query(
      `SELECT pd.id, j.nombre as titulo, pd.monto, pd.creado_en, pd.para 
       FROM juntada_pagos_deudas pd
       JOIN juntadas j ON j.id = pd.juntada_id
       WHERE LOWER(pd.de) = LOWER($1)`,
      [usuario]
    );

    for (const p of juntadasPagos) {
      pagosRecientes.push({
        id: p.id,
        titulo: p.titulo,
        sub: `Juntada - A ${p.para}`,
        tipo: 'Juntada',
        monto: Number(p.monto),
        fechaDate: new Date(p.creado_en), // Para ordenar
        esVivienda: false
      });
    }

    for (const { id } of ids) {
      const juntada = await cargarJuntadaCompleta(id);
      const balance = calcularBalance(juntada);

      for (const t of balance.transferencias) {
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

    // 2. Cargar Gastos y Servicios de Vivienda
    const serviciosAPagar = [];

    const { rows: [userRow] } = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(name) = LOWER($1)',
      [usuario]
    );

    if (userRow) {
      const { rows: [vm] } = await pool.query(
        'SELECT vivienda_id FROM vivienda_miembros WHERE usuario_id = $1 LIMIT 1',
        [userRow.id]
      );

      if (vm) {
        // Gastos
        const { rows: gastos } = await pool.query(
          'SELECT id, nombre, pagador, monto, status, fecha_pago, participantes FROM vivienda_gastos WHERE vivienda_id = $1 AND (status = $2 OR status = $3)',
          [vm.vivienda_id, 'PROCESADO', 'PAGADO']
        );

        for (const g of gastos) {
          if (!g.participantes.includes(usuario)) continue;

          const tuParte = g.monto / (g.participantes.length || 1);
          
          if (g.status === 'PROCESADO') {
            if (g.pagador.toLowerCase() !== usuario.toLowerCase()) {
              const acreedorKey = g.pagador.toLowerCase();
              if (!acreedoresMap.has(acreedorKey)) {
                acreedoresMap.set(acreedorKey, {
                  id: acreedorKey,
                  nombre: g.pagador,
                  avatar: getIniciales(g.pagador),
                  totalAcreedor: 0,
                  conceptos: [],
                });
              }
              const acreedor = acreedoresMap.get(acreedorKey);
              acreedor.totalAcreedor = Math.round((acreedor.totalAcreedor + tuParte) * 100) / 100;
              acreedor.conceptos.push({
                id: g.id,
                titulo: g.nombre,
                sub: 'Vivienda - Gasto',
                tipo: 'Vivienda',
                monto: Math.round(tuParte * 100) / 100,
                esVivienda: true,
                tipoVivienda: 'gastos'
              });
            }
          } else if (g.status === 'PAGADO') {
            pagosRecientes.push({
              id: g.id,
              titulo: g.nombre,
              sub: 'Vivienda - Gasto',
              tipo: 'Vivienda',
              monto: Math.round(tuParte * 100) / 100,
              fechaDate: g.fecha_pago ? new Date(g.fecha_pago) : new Date(),
              esVivienda: true,
              tipoVivienda: 'gastos'
            });
          }
        }

        // Servicios
        const { rows: servicios } = await pool.query(
          'SELECT id, nombre, monto, status, is_variable, participantes, fecha_pago FROM vivienda_servicios WHERE vivienda_id = $1 AND (status = $2 OR status = $3 OR status = $4)',
          [vm.vivienda_id, 'PENDIENTE', 'PROCESADO', 'PAGADO']
        );

        for (const s of servicios) {
          const montoTotal = s.monto || 0;
          const tuParte = montoTotal / (s.participantes.length || 1);

          if (s.status === 'PROCESADO' || s.status === 'PENDIENTE') {
            serviciosAPagar.push({
              id: s.id,
              titulo: s.nombre,
              sub: s.status === 'PENDIENTE' ? 'Vivienda (Esperando factura)' : 'Vivienda - Servicio',
              tipo: 'Vivienda',
              monto: s.status === 'PENDIENTE' ? null : Math.round(tuParte * 100) / 100,
              statusOriginal: s.status,
              esVivienda: true,
              tipoVivienda: 'servicios',
              isVariable: s.is_variable
            });
          } else if (s.status === 'PAGADO') {
            pagosRecientes.push({
              id: s.id,
              titulo: s.nombre,
              sub: 'Vivienda - Servicio',
              tipo: 'Vivienda',
              monto: Math.round(tuParte * 100) / 100,
              fechaDate: s.fecha_pago ? new Date(s.fecha_pago) : new Date(),
              esVivienda: true,
              tipoVivienda: 'servicios',
              isVariable: s.is_variable
            });
          }
        }
      }
    }

    // Ordenar y formatear pagos recientes
    pagosRecientes.sort((a, b) => b.fechaDate.getTime() - a.fechaDate.getTime());
    const pagosRecientesFormateados = pagosRecientes.map(p => {
      const pad = (n) => n.toString().padStart(2, '0');
      const formattedDate = `${pad(p.fechaDate.getDate())}/${pad(p.fechaDate.getMonth() + 1)}/${p.fechaDate.getFullYear()}`;
      const { fechaDate, ...rest } = p;
      return { ...rest, fecha: formattedDate };
    });

    res.json({ 
      ok: true, 
      data: {
        acreedores: Array.from(acreedoresMap.values()),
        serviciosAPagar,
        pagosRecientes: pagosRecientesFormateados
      }
    });
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
