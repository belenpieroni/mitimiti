const { Router } = require('express');
const ctrl = require('../controllers/viviendaController');

const router = Router();

router.get('/gastos', ctrl.listarGastos);
router.post('/gastos', ctrl.crearGasto);
router.put('/gastos/:id', ctrl.editarGasto);

router.get('/servicios', ctrl.listarServicios);
router.post('/servicios', ctrl.crearServicio);
router.put('/servicios/:id', ctrl.editarServicio);
//NURVO//
router.get('/acuerdos', ctrl.listarAcuerdos);
router.post('/acuerdos', ctrl.guardarAcuerdo);
router.delete('/acuerdos/:id', ctrl.eliminarAcuerdo);

module.exports = router;
