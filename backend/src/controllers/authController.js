const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPushToTokens } = require('../services/pushNotificationService');

const dbPath = path.join(__dirname, '../../data/db.json');

// ── Validaciones ────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

const DEFAULT_NOTIFICATION_PREFERENCES = {
  nuevosGastos: true,
  recordatoriosVencimiento: true,
  nuevasJuntadas: true,
};

const validateEmail = (email) => {
  return EMAIL_REGEX.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= MIN_PASSWORD_LENGTH;
};

const validateName = (name) => {
  return name && name.trim().length >= MIN_NAME_LENGTH;
};

// ── Gestión de Base de Datos ────────────────────────────────────────────────

const leerBBDD = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      const defaultDb = { usuarios: [], juntadas: [] };
      fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2), 'utf-8');
      return defaultDb;
    }
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    throw new Error('Error al leer la base de datos');
  }
};

const escribirBBDD = (data) => {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database:', error);
    throw new Error('Error al guardar la base de datos');
  }
};

// ── Utilidades ──────────────────────────────────────────────────────────────

const extractInitials = (name) => {
  return name
    .trim()
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'XX';
};

const normalizePreferences = (prefs = {}) => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...(typeof prefs === 'object' && prefs !== null ? prefs : {}),
});

// ── Controladores ───────────────────────────────────────────────────────────

exports.register = async (req, res, next) => {
  console.log('═══════════════════════');
  console.log('REGISTER RECIBIDO');
  console.log(req.body);

  try {
    const { name, email, password } = req.body;

    // Validar presencia de campos
    if (!name || !email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Faltan campos obligatorios: name, email, password' 
      });
    }

    // Validar nombre
    if (!validateName(name)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres` 
      });
    }

    // Validar email
    if (!validateEmail(email)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email inválido' 
      });
    }

    // Validar contraseña
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` 
      });
    }

    const db = leerBBDD();
    if (!db.usuarios) db.usuarios = [];

    // Validar si ya existe el email
    const existe = db.usuarios.find(u => u.email === email.toLowerCase());
    if (existe) {
      return res.status(400).json({ 
        ok: false, 
        error: 'El email ya está registrado' 
      });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const nuevoUsuario = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      iniciales: extractInitials(name),
      juntadas: 0,
      servicios: 0,
      viajes: 0,
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      creadoEn: new Date().toISOString()
    };

    // Guardar en base de datos
    db.usuarios.push(nuevoUsuario);
    escribirBBDD(db);

    return res.status(201).json({ 
      ok: true, 
      data: { 
        message: 'Usuario registrado con éxito',
        userId: nuevoUsuario.id
      } 
    });
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

    // Validar presencia de campos
    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email y contraseña requeridos' 
      });
    }

    const db = leerBBDD();
    if (!db.usuarios) db.usuarios = [];

    // Buscar usuario
    const usuario = db.usuarios.find(u => u.email === email.toLowerCase());
    if (!usuario) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Credenciales incorrectas' 
      });
    }

    // Comparar contraseña
    const passwordCorrecto = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecto) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Credenciales incorrectas' 
      });
    }

    // Generar JWT
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET || 'mitimiti_seguro_2026',
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
          notificationPreferences: normalizePreferences(usuario.notificationPreferences)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.registrarDeviceToken = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    const { deviceToken, platform = 'unknown' } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });
    }

    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(400).json({ ok: false, error: 'deviceToken es requerido.' });
    }

    const db = leerBBDD();
    if (!Array.isArray(db.usuarios)) {
      db.usuarios = [];
    }

    const usuario = db.usuarios.find((u) => u.id === userId);
    if (!usuario) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }

    if (!Array.isArray(usuario.deviceTokens)) {
      usuario.deviceTokens = [];
    }

    const existingIndex = usuario.deviceTokens.findIndex(
      (entry) => entry.token === deviceToken
    );

    const now = new Date().toISOString();
    const entry = {
      token: deviceToken,
      platform,
      lastSeenAt: now,
    };

    if (existingIndex >= 0) {
      usuario.deviceTokens[existingIndex] = {
        ...usuario.deviceTokens[existingIndex],
        ...entry,
      };
    } else {
      usuario.deviceTokens.push(entry);
    }

    escribirBBDD(db);

    return res.json({
      ok: true,
      data: {
        message: 'Device token registrado correctamente.',
        totalTokens: usuario.deviceTokens.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.obtenerPreferenciasNotificaciones = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });
    }

    const db = leerBBDD();
    if (!Array.isArray(db.usuarios)) {
      db.usuarios = [];
    }

    const usuario = db.usuarios.find((u) => u.id === userId);
    if (!usuario) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }

    const preferences = normalizePreferences(usuario.notificationPreferences);
    usuario.notificationPreferences = preferences;
    escribirBBDD(db);

    return res.json({ ok: true, data: preferences });
  } catch (error) {
    next(error);
  }
};

exports.actualizarPreferenciasNotificaciones = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });
    }

    const db = leerBBDD();
    if (!Array.isArray(db.usuarios)) {
      db.usuarios = [];
    }

    const usuario = db.usuarios.find((u) => u.id === userId);
    if (!usuario) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }

    const payload = req.body || {};
    const incoming = {
      nuevosGastos: payload.nuevosGastos,
      recordatoriosVencimiento: payload.recordatoriosVencimiento,
      nuevasJuntadas: payload.nuevasJuntadas,
    };

    const hasInvalidType = Object.values(incoming).some(
      (value) => value !== undefined && typeof value !== 'boolean'
    );

    if (hasInvalidType) {
      return res.status(400).json({
        ok: false,
        error: 'Las preferencias deben enviarse como valores booleanos.',
      });
    }

    const current = normalizePreferences(usuario.notificationPreferences);
    const nextPreferences = {
      ...current,
      ...Object.fromEntries(
        Object.entries(incoming).filter(([, value]) => value !== undefined)
      ),
    };

    usuario.notificationPreferences = nextPreferences;
    escribirBBDD(db);

    return res.json({ ok: true, data: nextPreferences });
  } catch (error) {
    next(error);
  }
};

exports.enviarPushPrueba = async (req, res, next) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado.' });
    }

    const db = leerBBDD();
    if (!Array.isArray(db.usuarios)) {
      db.usuarios = [];
    }

    const usuario = db.usuarios.find((u) => u.id === userId);
    if (!usuario) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }

    const tokens = Array.isArray(usuario.deviceTokens)
      ? usuario.deviceTokens.map((entry) => entry?.token).filter(Boolean)
      : [];

    if (!tokens.length) {
      return res.status(400).json({
        ok: false,
        error: 'No hay device tokens registrados para este usuario.',
      });
    }

    const result = await sendPushToTokens(tokens, {
      title: 'Push real de prueba',
      body: 'Esta notificacion viene desde el backend de Miti Miti.',
      data: {
        type: 'backend_push_test',
        userId: String(userId),
      },
    });

    return res.json({
      ok: true,
      data: {
        sent: result.sent,
        failed: result.failed,
      },
    });
  } catch (error) {
    next(error);
  }
};