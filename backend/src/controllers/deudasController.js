const { randomUUID: uuidv4 } = require('crypto');
const { pool } = require('../db');
const { notifyUsersByName } = require('../services/pushNotificationService');
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

    // 1. Cargar Juntadas (Pendientes y Pagos de juntada)
    const acreedoresMap = new Map();
    const pagosRecientes = [];

    // Traer pagos donde el usuario fue el que pagó (de) O el que recibió (para).
    // Con LOWER() en ambos lados para garantizar consistencia de mayúsculas.
    const { rows: juntadasPagos } = await pool.query(
      `SELECT pd.id, j.nombre as titulo, pd.monto, pd.creado_en, pd.de, pd.para
       FROM juntada_pagos_deudas pd
       JOIN juntadas j ON j.id = pd.juntada_id
       WHERE LOWER(pd.de) = LOWER($1) OR LOWER(pd.para) = LOWER($1)`,
      [usuario]
    );

    for (const p of juntadasPagos) {
      const elUsuarioPago = p.de.toLowerCase() === usuario.toLowerCase();
      const contraparte   = elUsuarioPago ? p.para : p.de;
      const subLabel      = elUsuarioPago
        ? `Juntada - Pagaste a ${contraparte}`
        : `Juntada - ${p.de} te pagó`;

      pagosRecientes.push({
        id: p.id,
        titulo: p.titulo,
        sub: subLabel,
        tipo: 'Juntada',
        monto: Number(p.monto),
        fechaDate: new Date(p.creado_en),
        esVivienda: false,
        isCompensacion: false
      });
    }

    for (const { id } of ids) {
      const juntada = await cargarJuntadaCompleta(id);
      const balance = calcularBalance(juntada);

      // Usamos transferenciasOriginales para mostrar el monto bruto correcto
      // (antes de descontar pagos parciales que reducirían el valor mostrado).
      for (const t of balance.transferenciasOriginales) {
        const isDeudor   = t.de.toLowerCase()   === usuario.toLowerCase();
        const isAcreedor = t.para.toLowerCase()  === usuario.toLowerCase();
        if (!isDeudor && !isAcreedor) continue;

        const contraparteKey    = isDeudor ? t.para.toLowerCase() : t.de.toLowerCase();
        const contraparteNombre = isDeudor ? t.para : t.de;

        if (!acreedoresMap.has(contraparteKey)) {
          acreedoresMap.set(contraparteKey, {
            id: contraparteKey,
            nombre: contraparteNombre,
            avatar: getIniciales(contraparteNombre),
            totalAcreedor: 0,
            conceptos: [],
          });
        }

        const contraparte  = acreedoresMap.get(contraparteKey);
        const amountSign   = isDeudor ? 1 : -1;

        contraparte.totalAcreedor = Math.round((contraparte.totalAcreedor + t.monto * amountSign) * 100) / 100;
        contraparte.conceptos.push({
          id: encodeConceptoId(juntada.id, t.de, t.para, t.monto),
          titulo: juntada.nombre,
          sub: 'Juntada',
          tipo: 'Juntada',
          monto: t.monto,
          tipoOperacion: isDeudor ? 'suma' : 'resta',
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
        // Consultar los porcentajes de todos los acuerdos de esta vivienda
        const { rows: acuerdosPart } = await pool.query(
          `SELECT ap.acuerdo_id, ap.nombre, ap.porcentaje
           FROM acuerdo_participantes ap
           JOIN vivienda_acuerdos va ON va.id = ap.acuerdo_id
           WHERE va.vivienda_id = $1`,
          [vm.vivienda_id]
        );

        const acuerdoMap = {};
        for (const ap of acuerdosPart) {
          if (!acuerdoMap[ap.acuerdo_id]) {
            acuerdoMap[ap.acuerdo_id] = {};
          }
          acuerdoMap[ap.acuerdo_id][ap.nombre.toLowerCase()] = Number(ap.porcentaje);
        }

        // Gastos
        const { rows: gastos } = await pool.query(
          'SELECT id, nombre, pagador, monto, status, fecha_pago, participantes, acuerdo_id FROM vivienda_gastos WHERE vivienda_id = $1 AND (status = $2 OR status = $3)',
          [vm.vivienda_id, 'PROCESADO', 'PAGADO']
        );

        for (const g of gastos) {
          const isParticipante = g.participantes && g.participantes.some(p => p.toLowerCase() === usuario.toLowerCase());
          const isPagador = g.pagador && g.pagador.toLowerCase() === usuario.toLowerCase();
          if (!isParticipante && !isPagador) continue;

          // Helper para obtener la parte correspondiente a un participante dado
          const getParteGasto = (nombreParticipante) => {
            if (g.acuerdo_id && acuerdoMap[g.acuerdo_id]) {
              const pct = acuerdoMap[g.acuerdo_id][nombreParticipante.toLowerCase()] || 0;
              return (Number(g.monto) * pct) / 100;
            } else {
              return Number(g.monto) / (g.participantes.length || 1);
            }
          };

          const tuParte = getParteGasto(usuario);
          
          if (g.status === 'PROCESADO') {
            if (isParticipante && !isPagador) {
              const contraparteKey = g.pagador.toLowerCase();
              if (!acreedoresMap.has(contraparteKey)) {
                acreedoresMap.set(contraparteKey, {
                  id: contraparteKey, nombre: g.pagador, avatar: getIniciales(g.pagador),
                  totalAcreedor: 0, conceptos: [],
                });
              }
              const contraparte = acreedoresMap.get(contraparteKey);
              contraparte.totalAcreedor = Math.round((contraparte.totalAcreedor + tuParte) * 100) / 100;
              contraparte.conceptos.push({
                id: g.id, titulo: g.nombre, sub: 'Vivienda - Gasto', tipo: 'Vivienda',
                monto: Math.round(tuParte * 100) / 100, esVivienda: true, tipoVivienda: 'gastos',
                tipoOperacion: 'suma'
              });
            } else if (isPagador) {
              for (const p of g.participantes) {
                if (p.toLowerCase() === usuario.toLowerCase()) continue;
                const contraparteKey = p.toLowerCase();
                if (!acreedoresMap.has(contraparteKey)) {
                  acreedoresMap.set(contraparteKey, {
                    id: contraparteKey, nombre: p, avatar: getIniciales(p),
                    totalAcreedor: 0, conceptos: [],
                  });
                }
                const parteDeP = getParteGasto(p);
                const contraparte = acreedoresMap.get(contraparteKey);
                contraparte.totalAcreedor = Math.round((contraparte.totalAcreedor - parteDeP) * 100) / 100;
                contraparte.conceptos.push({
                  id: g.id, titulo: g.nombre, sub: 'Vivienda - Gasto', tipo: 'Vivienda',
                  monto: Math.round(parteDeP * 100) / 100, esVivienda: true, tipoVivienda: 'gastos',
                  tipoOperacion: 'resta'
                });
              }
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
              isCompensacion: false
            });
          }
        }

        // Servicios
        const { rows: servicios } = await pool.query(
          'SELECT id, nombre, monto, status, is_variable, participantes, fecha_pago, acuerdo_id FROM vivienda_servicios WHERE vivienda_id = $1 AND (status = $2 OR status = $3 OR status = $4)',
          [vm.vivienda_id, 'PENDIENTE', 'PROCESADO', 'PAGADO']
        );

        for (const s of servicios) {
          const isParticipante = s.participantes && s.participantes.some(p => p.toLowerCase() === usuario.toLowerCase());
          if (!isParticipante) continue;

          const montoTotal = s.monto || 0;
          let tuParte = 0;
          if (s.acuerdo_id && acuerdoMap[s.acuerdo_id]) {
            const pct = acuerdoMap[s.acuerdo_id][usuario.toLowerCase()] || 0;
            tuParte = (montoTotal * pct) / 100;
          } else {
            tuParte = montoTotal / (s.participantes.length || 1);
          }

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
              isCompensacion: false
            });
          }
        }
      }
    }

    // 3. Cargar Compensaciones Históricas desde notificaciones
    const { rows: compensaciones } = await pool.query(
      `SELECT n.id::text, n.titulo, n.cuerpo, n.creada_en, n.payload
       FROM notificaciones_usuario n
       JOIN usuarios u ON u.id = n.usuario_id
       WHERE LOWER(u.name) = LOWER($1) AND n.payload->>'type' = 'compensacion'`,
      [usuario]
    );

    for (const c of compensaciones) {
      let pLoad = c.payload;
      if (typeof pLoad === 'string') {
        try { pLoad = JSON.parse(pLoad); } catch(e) {}
      }
      pagosRecientes.push({
        id: c.id,
        titulo: c.titulo,
        sub: c.cuerpo,
        tipo: 'Compensacion',
        monto: pLoad?.neto ? Number(pLoad.neto) : 0,
        fechaDate: new Date(c.creada_en),
        esVivienda: false,
        isCompensacion: true,
        gastosAFavor: pLoad?.gastosAFavor ? Number(pLoad.gastosAFavor) : 0,
        gastosEnContra: pLoad?.gastosEnContra ? Number(pLoad.gastosEnContra) : 0,
        contraparte: pLoad?.contraparte || ''
      });
    }

    // Ordenar y formatear pagos recientes
    pagosRecientes.sort((a, b) => b.fechaDate.getTime() - a.fechaDate.getTime());
    const pagosRecientesFormateados = pagosRecientes.map(p => {
      const pad = (n) => n.toString().padStart(2, '0');
      const formattedDate = `${pad(p.fechaDate.getDate())}/${pad(p.fechaDate.getMonth() + 1)}/${p.fechaDate.getFullYear()}`;
      const { fechaDate, ...rest } = p;
      return { ...rest, fecha: formattedDate, fecha_pago: p.fechaDate.toISOString() };
    });

    // No filtrar por totalAcreedor >= 0 para permitir que el acreedor (con saldo a favor) vea la deuda.
    const acreedoresFiltrados = Array.from(acreedoresMap.values()).filter(a => a.conceptos.length > 0);

    res.json({ 
      ok: true, 
      data: {
        acreedores: acreedoresFiltrados,
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
      `INSERT INTO juntada_pagos_deudas (id, juntada_id, de, para, monto)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, juntadaId, de, para, Number(monto)]
    );

    res.status(201).json({ ok: true, data: { id, juntadaId, de, para, monto: Number(monto), fecha } });
  } catch (err) {
    next(err);
  }
}

async function pagarMultiple(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items no es un array' });

    for (const item of items) {
      if (item.esVivienda) {
        const tabla = item.tipoVivienda === 'gastos' ? 'vivienda_gastos' : 'vivienda_servicios';
        await pool.query(`UPDATE ${tabla} SET status = 'PAGADO', fecha_pago = NOW() WHERE id::text = $1`, [item.id]);
      } else {
        const decoded = decodeConceptoId(item.id);
        if (decoded) {
          const { juntadaId, de, para, monto } = decoded;
          const pid = uuidv4();
          await pool.query(
            `INSERT INTO juntada_pagos_deudas (id, juntada_id, de, para, monto) VALUES ($1, $2, $3, $4, $5)`,
            [pid, juntadaId, de, para, Number(monto)]
          );
        }
      }
    }

    const { compensacion } = req.body;
    if (compensacion && compensacion.contraparte) {
      const deudorNombre = req.user?.name || req.user?.nombre || 'Alguien';
      const { contraparte, neto, gastosAFavor, gastosEnContra } = compensacion;

      // Notificar a la contraparte (Acreedor)
      notifyUsersByName(
        [contraparte],
        {
          title: '✅ Recibiste una compensación',
          body: `${deudorNombre} ha liquidado deudas cruzadas contigo. Saldo neto recibido: $${neto}.`,
          data: { 
            type: 'compensacion',
            neto,
            contraparte: deudorNombre,
            gastosAFavor: gastosEnContra ? Number(gastosEnContra) : 0,
            gastosEnContra: gastosAFavor ? Number(gastosAFavor) : 0
          }
        },
        { category: 'general' }
      ).catch(console.error);

      // Notificar al deudor (el usuario actual) para el historial
      notifyUsersByName(
        [deudorNombre],
        {
          title: '🔄 Has reducido tu deuda',
          body: `Compensación aplicada hoy. Se utilizaron tus gastos para reducir o liquidar tu deuda con ${contraparte}.`,
          data: { 
            type: 'compensacion',
            neto,
            contraparte,
            gastosAFavor: gastosAFavor ? Number(gastosAFavor) : 0,
            gastosEnContra: gastosEnContra ? Number(gastosEnContra) : 0
          }
        },
        { category: 'general' }
      ).catch(console.error);
    }

    res.status(201).json({ ok: true, message: 'Pagos procesados' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getConsolidado, pagarDeuda, pagarMultiple };
