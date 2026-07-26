const cron = require('node-cron');
const { pool } = require('../db');
const { notifyUsersByName, NOTIFICATION_CATEGORIES } = require('./pushNotificationService');

const DIAS_AVISO_PREVIO_1 = 3;
const DIAS_AVISO_PREVIO_2 = 1;
const FRECUENCIA_MORA_SERVICIOS = 3;
const FRECUENCIA_MORA_GASTOS = 7;

function getDiffDays(fechaStr) {
  const targetDate = new Date(fechaStr);
  const today = new Date();
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * Avanza una fecha según la periodicidad del servicio.
 * @param {string} fechaStr - Fecha ISO (YYYY-MM-DD)
 * @param {string} periodicidad - semanal, quincenal, mensual, bimestral, semestral, anual
 * @returns {string} Nueva fecha ISO
 */
function calcularProximaFecha(fechaStr, periodicidad) {
  const fecha = new Date(fechaStr);
  const p = (periodicidad || '').toLowerCase();

  switch (p) {
    case 'semanal':    fecha.setDate(fecha.getDate() + 7); break;
    case 'quincenal':  fecha.setDate(fecha.getDate() + 14); break;
    case 'mensual':    fecha.setMonth(fecha.getMonth() + 1); break;
    case 'bimestral':  fecha.setMonth(fecha.getMonth() + 2); break;
    case 'semestral':  fecha.setMonth(fecha.getMonth() + 6); break;
    case 'anual':      fecha.setFullYear(fecha.getFullYear() + 1); break;
    default:           fecha.setMonth(fecha.getMonth() + 1); break; // fallback mensual
  }

  return fecha.toISOString().split('T')[0];
}

// ── Cron: Reset de servicios variables ────────────────────────────────────────

async function resetServiciosVariables() {
  console.log('[cron] Verificando servicios variables para reset...');
  try {
    const hoyStr = new Date().toISOString().split('T')[0];

    const { rows: servicios } = await pool.query(
      `SELECT id::text, nombre, periodicidad, proximo_vencimiento::text AS "proximoVencimiento",
              participantes, vivienda_id::text AS "viviendaId"
       FROM vivienda_servicios
       WHERE is_variable = TRUE
         AND proximo_vencimiento <= $1`,
      [hoyStr]
    );

    for (const servicio of servicios) {
      const nuevaFecha = calcularProximaFecha(servicio.proximoVencimiento, servicio.periodicidad);

      await pool.query(
        `UPDATE vivienda_servicios
         SET monto = NULL, status = 'PENDIENTE', proximo_vencimiento = $1
         WHERE id = $2`,
        [nuevaFecha, servicio.id]
      );

      const destinatarios = Array.isArray(servicio.participantes)
        ? servicio.participantes
        : [];

      if (destinatarios.length > 0) {
        await notifyUsersByName(
          destinatarios,
          {
            title: 'Servicio requiere actualización',
            body: `Servicio "${servicio.nombre}" requiere actualización: ingrese el monto`,
            data: { type: 'variable_service_pending', servicioId: servicio.id },
          },
          { category: NOTIFICATION_CATEGORIES.SERVICIO_VARIABLE }
        );
      }

      console.log(`[cron] Servicio variable reseteado: ${servicio.nombre} → próximo: ${nuevaFecha}`);
    }

    if (servicios.length === 0) {
      console.log('[cron] No hay servicios variables para resetear.');
    }
  } catch (err) {
    console.error('[cron] Error reseteando servicios variables:', err.message);
  }
}

// ── Cron: Vencimientos próximos ───────────────────────────────────────────────

async function checkProximosVencimientos() {
  console.log('[cron] Verificando mora y vencimientos de servicios...');
  try {
    const { rows: servicios } = await pool.query(
      `SELECT s.id::text, s.nombre, s.proximo_vencimiento::text AS "proximoVencimiento", s.status, s.monto::float,
              s.acuerdo_id, s.participantes
       FROM vivienda_servicios s
       WHERE s.status != 'PAGADO'`
    );

    const hoyStr = new Date().toISOString().split('T')[0];

    for (const s of servicios) {
      const diff = getDiffDays(s.proximoVencimiento);
      let body = null;

      if (diff === DIAS_AVISO_PREVIO_1) {
        body = `🏠 Recordatorio: El servicio ${s.nombre} vence en ${DIAS_AVISO_PREVIO_1} días. Prepárate para realizar el pago.`;
      } else if (diff === DIAS_AVISO_PREVIO_2) {
        body = `⚠️ Mañana vence el servicio ${s.nombre}. No olvides abonar tu parte.`;
      } else if (diff < 0 && Math.abs(diff) % FRECUENCIA_MORA_SERVICIOS === 0) {
        body = `❌ El servicio ${s.nombre} está vencido. Por favor, regulariza tu parte pendiente para evitar cortes.`;
      }

      if (!body) continue;

      const { rows: [yaEnviado] } = await pool.query(
        `SELECT id FROM notificacion_recordatorios_enviados
         WHERE servicio_id = $1 AND fecha_recordatorio = $2`,
        [s.id, hoyStr]
      );
      if (yaEnviado) continue;

      let destinatarios = [];
      if (s.acuerdo_id) {
        const { rows: parts } = await pool.query('SELECT nombre, porcentaje FROM acuerdo_participantes WHERE acuerdo_id = $1', [s.acuerdo_id]);
        for (const p of parts) {
          if (s.monto && (s.monto * p.porcentaje / 100) > 0) {
            destinatarios.push(p.nombre);
          }
        }
      } else if (Array.isArray(s.participantes) && s.participantes.length > 0) {
        const porc = 100 / s.participantes.length;
        if (s.monto && (s.monto * porc / 100) > 0) {
          destinatarios = s.participantes;
        }
      }

      if (destinatarios.length > 0) {
        await notifyUsersByName(
          destinatarios,
          {
            title: 'Recordatorio de Servicio',
            body,
            data: { type: 'service_reminder', servicioId: s.id, url: 'mitimiti://deudas' },
          },
          { category: NOTIFICATION_CATEGORIES.RECORDATORIOS_VENCIMIENTO }
        );

        await pool.query(
          `INSERT INTO notificacion_recordatorios_enviados (servicio_id, fecha_recordatorio)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [s.id, hoyStr]
        );
        console.log(`[cron] Recordatorio de servicio enviado para: ${s.nombre}`);
      }
    }
  } catch (err) {
    console.error('[cron] Error verificando vencimientos:', err.message);
  }
}

// ── Cron: Gastos Puntuales Pendientes ─────────────────────────────────────────

async function checkGastosPendientes() {
  console.log('[cron] Verificando gastos puntuales pendientes...');
  try {
    const { rows: gastos } = await pool.query(
      `SELECT g.id::text, g.nombre, g.fecha::text, g.status, g.monto::float,
              g.acuerdo_id, g.participantes, g.pagador
       FROM vivienda_gastos g
       WHERE g.status != 'PAGADO'`
    );

    const hoyStr = new Date().toISOString().split('T')[0];

    for (const g of gastos) {
      const diff = Math.abs(getDiffDays(g.fecha));
      
      if (diff > 0 && diff % FRECUENCIA_MORA_GASTOS === 0) {
        const { rows: [yaEnviado] } = await pool.query(
          `SELECT id FROM notificacion_recordatorios_enviados
           WHERE servicio_id = $1 AND fecha_recordatorio = $2`,
          [g.id, hoyStr]
        );
        if (yaEnviado) continue;

        let destinatarios = [];
        const montoGasto = g.monto || 0;
        
        if (g.acuerdo_id) {
          const { rows: parts } = await pool.query('SELECT nombre, porcentaje FROM acuerdo_participantes WHERE acuerdo_id = $1', [g.acuerdo_id]);
          for (const p of parts) {
            const montoIndiv = (montoGasto * p.porcentaje / 100);
            if (montoIndiv > 0 && p.nombre.toLowerCase() !== g.pagador.toLowerCase()) {
              destinatarios.push({ nombre: p.nombre, monto: montoIndiv });
            }
          }
        } else if (Array.isArray(g.participantes) && g.participantes.length > 0) {
          const porc = 100 / g.participantes.length;
          const montoIndiv = (montoGasto * porc / 100);
          for (const p of g.participantes) {
            if (montoIndiv > 0 && p.toLowerCase() !== g.pagador.toLowerCase()) {
              destinatarios.push({ nombre: p, monto: montoIndiv });
            }
          }
        }

        for (const dest of destinatarios) {
          const body = `❌ Tienes un gasto pendiente de ${g.nombre} con ${g.pagador} por $${dest.monto.toLocaleString('es-AR')}.`;
          await notifyUsersByName(
            [dest.nombre],
            {
              title: 'Recordatorio de Gasto',
              body,
              data: { type: 'gasto_reminder', gastoId: g.id, url: 'mitimiti://deudas' },
            },
            { category: NOTIFICATION_CATEGORIES.RECORDATORIOS_VENCIMIENTO }
          );
        }

        if (destinatarios.length > 0) {
          await pool.query(
            `INSERT INTO notificacion_recordatorios_enviados (servicio_id, fecha_recordatorio)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [g.id, hoyStr]
          );
          console.log(`[cron] Recordatorio de gasto enviado para: ${g.nombre}`);
        }
      }
    }
  } catch (err) {
    console.error('[cron] Error verificando gastos pendientes:', err.message);
  }
}

function iniciarCronJobs() {
  cron.schedule('0 9 * * *', async () => {
    await resetServiciosVariables();
    await checkProximosVencimientos();
    await checkGastosPendientes();
  }, { timezone: 'America/Argentina/Buenos_Aires' });
  console.log('[cron] Cron de vencimientos, servicios variables y cobranza social iniciado.');
}

module.exports = { iniciarCronJobs, resetServiciosVariables, calcularProximaFecha, checkProximosVencimientos, checkGastosPendientes };
