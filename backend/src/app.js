require('dotenv').config();
const perfilesRoutes = require('./routes/perfiles');
const express = require('express');
const cors = require('cors');
const juntadasRouter = require('./routes/juntadas');
const authRouter = require('./routes/auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: 'Miti Miti API v1 — Módulo Juntadas & Auth',
    version: '1.0.0',
    endpoints: {
      auth: ['/api/auth/register', '/api/auth/login'],
      juntadas: '/api/juntadas'
    }
  });
});

app.use('/api/juntadas', juntadasRouter);
app.use('/api/auth', authRouter);
app.use('/api/perfiles', perfilesRoutes);

// ── Manejo de errores ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Arranque ──────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╭───────────────────────────────────────────────────────────────╮
│  Miti Miti Backend - Iniciado                                 │
│  Puerto: ${PORT}                                              │
│  Ambiente: ${process.env.NODE_ENV || 'development'}           │
│  Escuchando en: http://0.0.0.0:${PORT}                        │
╰───────────────────────────────────────────────────────────────╯
Endpoints:
  • Autenticación: /api/auth/register, /api/auth/login
  • Juntadas: /api/juntadas
  `);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;