const express = require('express');
const cors = require('cors');
const juntadasRouter = require('./routes/juntadas');
const perfilesRouter = require('./routes/perfiles');
const viviendaRouter = require('./routes/vivienda');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { iniciarCron } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());                        // Permite peticiones desde la app Expo
app.use(express.json());                // Parsea body JSON

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'Miti Miti API v1 — Módulo Juntadas' });
});

app.use('/api/juntadas', juntadasRouter);
app.use('/api/perfiles', perfilesRouter);
app.use('/api/vivienda', viviendaRouter);

// ── Manejo de errores ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Arranque ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Miti Miti backend escuchando en http://localhost:${PORT}`);
  console.log(`    Docs de endpoints disponibles en /api/juntadas`);
  iniciarCron();
});

module.exports = app;