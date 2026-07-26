const { Router } = require('express');
const ctrl = require('../controllers/juntadasController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// ── Balance global (debe ir ANTES de /:id para no confundirse con un id) ─────
router.get('/balance/global/:nombre', ctrl.obtenerBalanceGlobal);

// ── Invitaciones (antes de /:id) ──────────────────────────────────────────────
router.post('/join/:token', requireAuth, ctrl.unirseViaToken);

// ── Juntadas ──────────────────────────────────────────────────────────────────
router.get('/',     ctrl.listarJuntadas);
router.post('/',    requireAuth, ctrl.crearJuntada);
router.get('/:id',  requireAuth, ctrl.obtenerJuntada);
router.patch('/:id', requireAuth, ctrl.editarJuntada);
router.delete('/:id', requireAuth, ctrl.eliminarJuntada);

// ── Participantes ─────────────────────────────────────────────────────────────
router.post('/:id/participantes',         ctrl.agregarParticipante);
router.delete('/:id/participantes/:pid',  ctrl.quitarParticipante);

// ── Gastos ────────────────────────────────────────────────────────────────────
router.post('/:id/gastos',        ctrl.agregarGasto);
router.delete('/:id/gastos/:gid', ctrl.eliminarGasto);

router.post('/:id/subgrupos', ctrl.agregarSubgrupo);
router.patch('/:id/subgrupos/:sgid', ctrl.editarSubgrupo);
router.delete('/:id/subgrupos/:sgid', ctrl.eliminarSubgrupo);

// ── Balance de juntada ────────────────────────────────────────────────────────
router.get('/:id/balance', ctrl.obtenerBalance);

// ── Invitación de juntada ─────────────────────────────────────────────────────
router.get('/:id/invitacion',  requireAuth, ctrl.generarObtenerInvitacion);
router.post('/:id/invitacion', requireAuth, ctrl.generarObtenerInvitacion);

module.exports = router;