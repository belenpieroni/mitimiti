const express = require('express');
const cors = require('cors');
const juntadasRouter = require('./routes/juntadas');
const perfilesRouter = require('./routes/perfiles');
const deudasRoutes = require('./routes/deudas');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'Miti Miti API v1 — Módulo Juntadas' });
});

app.use('/api/juntadas', juntadasRouter);
app.use('/api/perfiles', perfilesRouter);
app.use('/api/deudas', deudasRoutes);

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
});

module.exports = app;