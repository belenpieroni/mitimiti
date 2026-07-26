const { Router } = require('express');
const ctrl = require('../controllers/viviendaController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

router.use(requireAuth);

router.get('/actual', ctrl.obtenerMiVivienda);
router.post('/crear', ctrl.crearMiVivienda);
router.patch('/actual', ctrl.editarMiVivienda);
router.delete('/actual', ctrl.eliminarMiVivienda);
router.get('/invitacion', ctrl.generarObtenerInvitacion);
router.post('/invitacion', ctrl.generarObtenerInvitacion);
router.post('/join/:token', ctrl.unirseViaToken);

router.get('/gastos', ctrl.listarGastos);
router.post('/gastos', ctrl.crearGasto);
router.put('/gastos/:id', ctrl.editarGasto);
router.delete('/gastos/:id', ctrl.eliminarGasto);

router.get('/servicios', ctrl.listarServicios);
router.post('/servicios', ctrl.crearServicio);
router.put('/servicios/:id', ctrl.editarServicio);
router.delete('/servicios/:id', ctrl.eliminarServicio);
router.patch('/servicios/:id/liquidar', ctrl.liquidarServicio);
router.patch('/:tipo/:id/pagar', ctrl.marcarComoPagado);
router.patch('/:tipo/:id/revertir', ctrl.revertirPago);
//NURVO//
router.get('/acuerdos', ctrl.listarAcuerdos);
router.post('/acuerdos', ctrl.guardarAcuerdo);
router.put('/acuerdos/:id', ctrl.editarAcuerdo);
router.delete('/acuerdos/:id', ctrl.eliminarAcuerdo);

module.exports = router;
