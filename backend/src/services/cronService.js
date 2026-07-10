const cron = require('node-cron');
const { pool } = require('../db');
const { notifyUsersByName, NOTIFICATION_CATEGORIES } = require('./pushNotificationService');

const DIAS_DE_ANTICIPACION = 2;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

    // Buscar servicios variables cuyo ciclo de facturación ya pasó
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

      // Resetear: monto null, status PENDIENTE, avanzar fecha
      await pool.query(
        `UPDATE vivienda_servicios
         SET monto = NULL, status = 'PENDIENTE', proximo_vencimiento = $1
         WHERE id = $2`,
        [nuevaFecha, servicio.id]
      );

      // Notificar a participantes
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
  console.log('[cron] Verificando vencimientos de servicios...');
  try {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_DE_ANTICIPACION);
    const limiteStr = limite.toISOString().split('T')[0];
    const hoyStr = hoy.toISOString().split('T')[0];

    const { rows: servicios } = await pool.query(
      `SELECT id::text, nombre, proximo_vencimiento::text AS "proximoVencimiento", participantes
       FROM vivienda_servicios
       WHERE proximo_vencimiento BETWEEN $1 AND $2`,
      [hoyStr, limiteStr]
    );

    for (const servicio of servicios) {
      const { rows: [yaEnviado] } = await pool.query(
        `SELECT id FROM notificacion_recordatorios_enviados
         WHERE servicio_id = $1 AND fecha_recordatorio = $2`,
        [servicio.id, servicio.proximoVencimiento]
      );

      if (yaEnviado) continue;

      const destinatarios = Array.isArray(servicio.participantes)
        ? servicio.participantes
        : [];

      if (destinatarios.length > 0) {
        await notifyUsersByName(
          destinatarios,
          {
            title: 'Vencimiento próximo',
            body: `"${servicio.nombre}" vence el ${servicio.proximoVencimiento}`,
            data: { type: 'service_reminder', servicioId: servicio.id },
          },
          { category: NOTIFICATION_CATEGORIES.RECORDATORIOS_VENCIMIENTO }
        );
      }

      await pool.query(
        `INSERT INTO notificacion_recordatorios_enviados (servicio_id, fecha_recordatorio)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [servicio.id, servicio.proximoVencimiento]
      );

      console.log(`[cron] Recordatorio enviado para: ${servicio.nombre}`);
    }
  } catch (err) {
    console.error('[cron] Error verificando vencimientos:', err.message);
  }
}

function iniciarCronJobs() {
  // Ejecuta cada día a las 09:00
  cron.schedule('0 9 * * *', async () => {
    await resetServiciosVariables();
    await checkProximosVencimientos();
  }, { timezone: 'America/Argentina/Buenos_Aires' });
  console.log('[cron] Cron de vencimientos y servicios variables iniciado.');
}

module.exports = { iniciarCronJobs, resetServiciosVariables, calcularProximaFecha };
