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


router.get('/:id/balance', ctrl.obtenerBalance);


router.get('/:id/invitacion',  requireAuth, ctrl.generarObtenerInvitacion);
router.post('/:id/invitacion', requireAuth, ctrl.generarObtenerInvitacion);

module.exports = router;