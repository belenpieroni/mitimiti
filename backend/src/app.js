require('dotenv').config();
const perfilesRoutes = require('./routes/perfiles');
const express = require('express');
const cors = require('cors');
const path = require('path');
const juntadasRouter = require('./routes/juntadas');
const perfilesRouter = require('./routes/perfiles');
const deudasRoutes = require('./routes/deudas');
const viviendaRouter = require('./routes/vivienda');
const uploadsRouter = require('./routes/uploads');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { iniciarCronJobs } = require('./services/cronService');
const { inicializarDB } = require('./db');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'Miti Miti API v1 — Módulo Juntadas' });
});

app.use('/api/juntadas', juntadasRouter);
app.use('/api/perfiles', perfilesRouter);
app.use('/api/deudas', deudasRoutes);
app.use('/api/vivienda', viviendaRouter);
app.use('/api/deudas', deudasRoutes);
app.use('/api/uploads', uploadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/perfiles', perfilesRoutes);

app.use(notFound);
app.use(errorHandler);

app._router.stack.forEach(r => {
  if (r.name === 'router') console.log('Router registrado:', r.regexp);
});

async function start() {
  await inicializarDB();
  app.listen(PORT, () => {
    console.log(`    Miti Miti backend escuchando en http://localhost:${PORT}`);
    console.log(`    Docs de endpoints disponibles en /api/juntadas`);
    iniciarCronJobs();
  });
}

start().catch((err) => {
  console.error('[startup] Error fatal al iniciar el servidor:', err);
  process.exit(1);
});

module.exports = app;