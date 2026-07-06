const cron = require('node-cron');
const { pool } = require('../db');
const { notifyUsersByName, NOTIFICATION_CATEGORIES } = require('./pushNotificationService');

const DIAS_DE_ANTICIPACION = 2;

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
  cron.schedule('0 9 * * *', checkProximosVencimientos, { timezone: 'America/Argentina/Buenos_Aires' });
  console.log('[cron] Cron de vencimientos iniciado.');
}

module.exports = { iniciarCronJobs };
