const { Expo } = require('expo-server-sdk');
const { randomUUID } = require('crypto');
const { pool } = require('../db');

const expo = new Expo();

const NOTIFICATION_CATEGORIES = {
  NUEVOS_GASTOS: 'nuevos_gastos',
  RECORDATORIOS_VENCIMIENTO: 'recordatorios_vencimiento',
  NUEVAS_JUNTADAS: 'nuevas_juntadas',
  SERVICIO_VARIABLE: 'servicio_variable',
};

const PREF_COLUMN_MAP = {
  [NOTIFICATION_CATEGORIES.NUEVOS_GASTOS]: 'notif_nuevos_gastos',
  [NOTIFICATION_CATEGORIES.RECORDATORIOS_VENCIMIENTO]: 'notif_recordatorios_vencimiento',
  [NOTIFICATION_CATEGORIES.NUEVAS_JUNTADAS]: 'notif_nuevas_juntadas',
  [NOTIFICATION_CATEGORIES.SERVICIO_VARIABLE]: 'notif_recordatorios_vencimiento',
};

/**
 * Envía una notificación push a usuarios por nombre.
 * @param {string[]} names - Nombres de los destinatarios.
 * @param {{ title: string, body: string, data?: object }} payload
 * @param {{ category?: string }} options
 */
async function notifyUsersByName(names, payload, options = {}) {
  if (!names || names.length === 0) return { sent: 0, failed: 0 };

  const normalizedNames = names.map((n) => n.trim().toLowerCase());
  const { category } = options;
  const prefColumn = category ? PREF_COLUMN_MAP[category] : null;

  const usuariosQuery = prefColumn
    ? `
      SELECT u.id::text, u.name
      FROM usuarios u
      WHERE LOWER(u.name) = ANY($1)
        AND u.${prefColumn} = TRUE
    `
    : `
      SELECT u.id::text, u.name
      FROM usuarios u
      WHERE LOWER(u.name) = ANY($1)
    `;

  const { rows: usuarios } = await pool.query(usuariosQuery, [normalizedNames]);

  if (usuarios.length === 0) return { sent: 0, failed: 0 };

  await guardarNotificacionesEnBD(usuarios, payload, category || 'general');

  const userIds = usuarios.map((u) => u.id);
  const { rows: tokenRows } = await pool.query(
    'SELECT token FROM usuario_device_tokens WHERE usuario_id::text = ANY($1)',
    [userIds]
  );
  const tokens = tokenRows.map((r) => r.token).filter(Boolean);

  if (tokens.length === 0) return { sent: 0, failed: 0 };

  return sendPushToTokens(tokens, payload);
}

async function guardarNotificacionesEnBD(usuarios, payload, categoria) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const usuario of usuarios) {
      await client.query(
        `INSERT INTO notificaciones_usuario (id, usuario_id, categoria, titulo, cuerpo, payload)
         VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb)`,
        [
          randomUUID(),
          usuario.id,
          categoria,
          payload.title || 'Notificacion',
          payload.body || '',
          JSON.stringify(payload.data || {}),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Envía push a una lista de tokens directamente.
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: object }} payload
 */
async function sendPushToTokens(tokens, payload) {
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

  if (validTokens.length === 0) {
    console.warn('[push] No hay tokens Expo válidos.');
    return { sent: 0, failed: tokens.length };
  }

  const messages = validTokens.map((to) => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  }));

  let sent = 0;
  let failed = 0;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      receipts.forEach((receipt) => {
        if (receipt.status === 'ok') sent++;
        else {
          console.error('[push] Error en receipt:', receipt.message, receipt.details);
          failed++;
        }
      });
    } catch (err) {
      console.error('[push] Error enviando chunk:', err.message);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

module.exports = { notifyUsersByName, sendPushToTokens, NOTIFICATION_CATEGORIES };
