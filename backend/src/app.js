const express = require('express');
const cors = require('cors');
const path = require('path');
const juntadasRouter = require('./routes/juntadas');
const perfilesRouter = require('./routes/perfiles');
<<<<<<< HEAD
const deudasRoutes = require('./routes/deudas');
=======
const uploadsRouter = require('./routes/uploads');
>>>>>>> entrega-2
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
<<<<<<< HEAD
app.use(cors());
app.use(express.json());
=======
app.use(cors());                        // Permite peticiones desde la app Expo
app.use(express.json());                // Parsea body JSON
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir archivos estáticos (mismo dir que multer: src/uploads)
>>>>>>> entrega-2

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'Miti Miti API v1 — Módulo Juntadas' });
});

app.use('/api/juntadas', juntadasRouter);
app.use('/api/perfiles', perfilesRouter);
<<<<<<< HEAD
app.use('/api/deudas', deudasRoutes);
=======
app.use('/api/uploads', uploadsRouter);
>>>>>>> entrega-2

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