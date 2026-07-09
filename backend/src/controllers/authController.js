const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { sendPushToTokens } = require('../services/pushNotificationService');

// ── Validaciones ────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

const validateEmail = (email) => EMAIL_REGEX.test(email);
const validatePassword = (password) => password && password.length >= MIN_PASSWORD_LENGTH;
const validateName = (name) => name && name.trim().length >= MIN_NAME_LENGTH;

const extractInitials = (name) =>
  name.trim().split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase() || 'XX';

// ── Controladores ───────────────────────────────────────────────────────────

exports.register = async (req, res, next) => {
  console.log('═══════════════════════');
  console.log('REGISTER RECIBIDO');
  console.log(req.body);

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios: name, email, password' });
    if (!validateName(name))
      return res.status(400).json({ ok: false, error: `Nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres` });
    if (!validateEmail(email))
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    if (!validatePassword(password))
      return res.status(400).json({ ok: false, error: `Contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });

    const { rows: existing } = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.length > 0)
      return res.status(400).json({ ok: false, error: 'El email ya está registrado' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO usuarios (id, name, email, password, iniciales)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name.trim(), email.toLowerCase(), hashedPassword, extractInitials(name)]
    );

    return res.status(201).json({ ok: true, data: { message: 'Usuario registrado con éxito', userId: id } });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  console.log('═══════════════════════');
  console.log('LOGIN RECIBIDO');
  console.log(req.body);

  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });

    const { rows } = await pool.query(
      `SELECT id, name, email, password, iniciales, juntadas, servicios, viajes,
              notif_nuevos_gastos, notif_recordatorios_vencimiento, notif_nuevas_juntadas
       FROM usuarios WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!rows.length)
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });

    const usuario = rows[0];
    const passwordCorrecto = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecto)
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, name: usuario.name },
      process.env.JWT_SECRET || 'fallback_secret_dev',
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      data: {
        token,
        user: {
          id: usuario.id,
          name: usuario.name,
          email: usuario.email,
          iniciales: usuario.iniciales,
          juntadas: usuario.juntadas,
          servicios: usuario.servicios,
          viajes: usuario.viajes,
          notificationPreferences: {
            nuevosGastos: usuario.notif_nuevos_gastos,
            recordatoriosVencimiento: usuario.notif_recordatorios_vencimiento,
            nuevasJuntadas: usuario.notif_nuevas_juntadas,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.registrarDeviceToken = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    const { deviceToken, platform = 'unknown' } = req.body;
    if (!deviceToken)
      return res.status(400).json({ ok: false, error: 'deviceToken requerido.' });

    await pool.query(
      `INSERT INTO usuario_device_tokens (usuario_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, token) DO NOTHING`,
      [userId, deviceToken, platform]
    );

    return res.json({ ok: true, data: { message: 'Token registrado correctamente.' } });
  } catch (error) {
    next(error);
  }
};

exports.obtenerPreferenciasNotificaciones = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    const { rows } = await pool.query(
      `SELECT notif_nuevos_gastos, notif_recordatorios_vencimiento, notif_nuevas_juntadas
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });

    const u = rows[0];
    return res.json({
      ok: true,
      data: {
        nuevosGastos: u.notif_nuevos_gastos,
        recordatoriosVencimiento: u.notif_recordatorios_vencimiento,
        nuevasJuntadas: u.notif_nuevas_juntadas,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.actualizarPreferenciasNotificaciones = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    const { nuevosGastos, recordatoriosVencimiento, nuevasJuntadas } = req.body || {};
    const incoming = { nuevosGastos, recordatoriosVencimiento, nuevasJuntadas };

    const hasInvalidType = Object.values(incoming).some(
      (v) => v !== undefined && typeof v !== 'boolean'
    );
    if (hasInvalidType)
      return res.status(400).json({ ok: false, error: 'Las preferencias deben enviarse como valores booleanos.' });

    const updates = [];
    const values = [];
    let idx = 1;

    if (nuevosGastos !== undefined) { updates.push(`notif_nuevos_gastos = $${idx++}`); values.push(nuevosGastos); }
    if (recordatoriosVencimiento !== undefined) { updates.push(`notif_recordatorios_vencimiento = $${idx++}`); values.push(recordatoriosVencimiento); }
    if (nuevasJuntadas !== undefined) { updates.push(`notif_nuevas_juntadas = $${idx++}`); values.push(nuevasJuntadas); }

    if (updates.length === 0)
      return res.status(400).json({ ok: false, error: 'No se proporcionaron preferencias para actualizar.' });

    values.push(userId);
    const { rows } = await pool.query(
      `UPDATE usuarios SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING notif_nuevos_gastos, notif_recordatorios_vencimiento, notif_nuevas_juntadas`,
      values
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });

    const u = rows[0];
    return res.json({
      ok: true,
      data: {
        nuevosGastos: u.notif_nuevos_gastos,
        recordatoriosVencimiento: u.notif_recordatorios_vencimiento,
        nuevasJuntadas: u.notif_nuevas_juntadas,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.enviarPushPrueba = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    const { rows } = await pool.query(
      'SELECT token FROM usuario_device_tokens WHERE usuario_id = $1',
      [userId]
    );
    const tokens = rows.map((r) => r.token).filter(Boolean);

    if (!tokens.length)
      return res.status(400).json({ ok: false, error: 'No hay device tokens registrados para este usuario.' });

    await pool.query(
      `INSERT INTO notificaciones_usuario (id, usuario_id, categoria, titulo, cuerpo, payload)
       VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb)`,
      [
        crypto.randomUUID(),
        userId,
        'backend_push_test',
        'Push real de prueba',
        'Esta notificacion viene desde el backend de Miti Miti.',
        JSON.stringify({ type: 'backend_push_test', userId: String(userId) }),
      ]
    );

    const result = await sendPushToTokens(tokens, {
      title: 'Push real de prueba',
      body: 'Esta notificacion viene desde el backend de Miti Miti.',
      data: { type: 'backend_push_test', userId: String(userId) },
    });

    return res.json({ ok: true, data: { sent: result.sent, failed: result.failed } });
  } catch (error) {
    next(error);
  }
};

exports.listarNotificaciones = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    const { rows } = await pool.query(
      `SELECT id::text, categoria, titulo, cuerpo, payload, leida, creada_en
       FROM notificaciones_usuario
       WHERE usuario_id = $1
       ORDER BY creada_en DESC
       LIMIT 100`,
      [userId]
    );

    return res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.marcarNotificacionLeida = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    const { id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE notificaciones_usuario
       SET leida = TRUE
       WHERE id = $1::uuid AND usuario_id = $2::uuid`,
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Notificacion no encontrada.' });
    }

    return res.json({ ok: true, data: { id, leida: true } });
  } catch (error) {
    next(error);
  }
};

exports.marcarTodasLeidas = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });

    await pool.query(
      'UPDATE notificaciones_usuario SET leida = TRUE WHERE usuario_id = $1::uuid',
      [userId]
    );

    return res.json({ ok: true, data: { allRead: true } });
  } catch (error) {
    next(error);
  }
};
