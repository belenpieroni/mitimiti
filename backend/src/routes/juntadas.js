/**
 * routes/juntadas.js
 * ───────────────────
 * Define todas las rutas del módulo Juntadas.
 *
 * Prefijo base (definido en app.js): /api/juntadas
 *
 * Tabla de endpoints:
 * ┌─────────────────────────────────────────────────────┬──────────────────────────────┐
 * │ Método + Ruta                                       │ Descripción                  │
 * ├─────────────────────────────────────────────────────┼──────────────────────────────┤
 * │ GET    /api/juntadas                                │ Listar todas las juntadas    │
 * │ POST   /api/juntadas                                │ Crear juntada                │
 * │ GET    /api/juntadas/:id                            │ Obtener juntada + balance    │
 * │ DELETE /api/juntadas/:id                            │ Eliminar juntada             │
 * │ POST   /api/juntadas/:id/participantes              │ Agregar participante         │
 * │ DELETE /api/juntadas/:id/participantes/:pid         │ Quitar participante          │
 * │ POST   /api/juntadas/:id/gastos                     │ Agregar gasto                │
 * │ DELETE /api/juntadas/:id/gastos/:gid                │ Eliminar gasto               │
 * │ GET    /api/juntadas/:id/balance                    │ Balance de una juntada       │
 * │ GET    /api/juntadas/balance/global/:nombre         │ Balance global del usuario   │
 * └─────────────────────────────────────────────────────┴──────────────────────────────┘
 */

const { Router } = require('express');
const ctrl = require('../controllers/juntadasController');

const router = Router();

// ── Balance global (debe ir ANTES de /:id para no confundirse con un id) ─────
router.get('/balance/global/:nombre', ctrl.obtenerBalanceGlobal);

// ── Juntadas ──────────────────────────────────────────────────────────────────
router.get('/',     ctrl.listarJuntadas);
router.post('/',    ctrl.crearJuntada);
router.get('/:id',  ctrl.obtenerJuntada);
router.patch('/:id', ctrl.editarJuntada);
router.delete('/:id', ctrl.eliminarJuntada);

// ── Participantes ─────────────────────────────────────────────────────────────
router.post('/:id/participantes',         ctrl.agregarParticipante);
router.delete('/:id/participantes/:pid',  ctrl.quitarParticipante);

// ── Gastos ────────────────────────────────────────────────────────────────────
router.post('/:id/gastos',        ctrl.agregarGasto);
router.delete('/:id/gastos/:gid', ctrl.eliminarGasto);

// Subgrupos
router.post('/:id/subgrupos', ctrl.agregarSubgrupo);
router.patch('/:id/subgrupos/:sgid', ctrl.editarSubgrupo);
router.delete('/:id/subgrupos/:sgid', ctrl.eliminarSubgrupo);

// ── Balance de juntada ────────────────────────────────────────────────────────
router.get('/:id/balance', ctrl.obtenerBalance);

module.exports = router;