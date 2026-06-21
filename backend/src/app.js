const express = require('express');
const cors = require('cors');
const path = require('path');
const juntadasRouter = require('./routes/juntadas');
const perfilesRouter = require('./routes/perfiles');
const deudasRoutes = require('./routes/deudas');
const viviendaRouter = require('./routes/vivienda');
const uploadsRouter = require('./routes/uploads');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { iniciarCron } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());                        // Permite peticiones desde la app Expo
app.use(express.json());                // Parsea body JSON
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir archivos estáticos (mismo dir que multer: src/uploads)

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'Miti Miti API v1 — Módulo Juntadas' });
});

app.use('/api/juntadas', juntadasRouter);
app.use('/api/perfiles', perfilesRouter);
app.use('/api/deudas', deudasRoutes);
app.use('/api/vivienda', viviendaRouter);
app.use('/api/deudas', deudasRoutes);
app.use('/api/uploads', uploadsRouter);

// ── Manejo de errores ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// Justo antes de app.listen
app._router.stack.forEach(r => {
  if (r.name === 'router') console.log('Router registrado:', r.regexp);
});

// ── Arranque ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Miti Miti backend escuchando en http://localhost:${PORT}`);
  console.log(`    Docs de endpoints disponibles en /api/juntadas`);
  iniciarCron();
});

module.exports = app;