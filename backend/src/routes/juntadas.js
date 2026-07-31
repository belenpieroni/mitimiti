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
 * │ POST   /api/juntadas/:id/subgrupos/:sgid/unirse     │ Unirse a un subgrupo         │
 * │ POST   /api/juntadas/:id/subgrupos/:sgid/salir      │ Salir de un subgrupo         │
 * └─────────────────────────────────────────────────────┴──────────────────────────────┘
 */

const { Router } = require('express');
const ctrl = require('../controllers/juntadasController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();


router.get('/balance/global/:nombre', ctrl.obtenerBalanceGlobal);


router.post('/join/:token', requireAuth, ctrl.unirseViaToken);


router.get('/',     ctrl.listarJuntadas);
router.post('/',    requireAuth, ctrl.crearJuntada);
router.get('/:id',  requireAuth, ctrl.obtenerJuntada);
router.patch('/:id', requireAuth, ctrl.editarJuntada);
router.delete('/:id', requireAuth, ctrl.eliminarJuntada);


router.post('/:id/participantes',         ctrl.agregarParticipante);
router.delete('/:id/participantes/:pid',  ctrl.quitarParticipante);


router.post('/:id/gastos',        ctrl.agregarGasto);
router.delete('/:id/gastos/:gid', ctrl.eliminarGasto);

router.post('/:id/subgrupos', ctrl.agregarSubgrupo);
router.patch('/:id/subgrupos/:sgid', ctrl.editarSubgrupo);
router.delete('/:id/subgrupos/:sgid', ctrl.eliminarSubgrupo);

router.post('/:id/subgrupos/:sgid/unirse', requireAuth, ctrl.unirseSubgrupo);
router.post('/:id/subgrupos/:sgid/salir',  requireAuth, ctrl.salirSubgrupo);

// ── Balance de juntada ────────────────────────────────────────────────────────
router.get('/:id/balance', ctrl.obtenerBalance);


router.get('/:id/invitacion',  requireAuth, ctrl.generarObtenerInvitacion);
router.post('/:id/invitacion', requireAuth, ctrl.generarObtenerInvitacion);

module.exports = router;