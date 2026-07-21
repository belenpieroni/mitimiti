const express = require('express');
const router = express.Router();
const deudasController = require('../controllers/deudasController');

// Ruta para obtener el consolidado de todas tus deudas
router.get('/consolidado/:usuarioNombre', deudasController.getConsolidado);

// Ruta futura para marcar una deuda como pagada
// El frontend llamará a: PATCH /api/deudas/pagar/:deudaId
router.patch('/pagar/:deudaId', deudasController.pagarDeuda);
router.post('/pagar_multiple', deudasController.pagarMultiple);

module.exports = router;