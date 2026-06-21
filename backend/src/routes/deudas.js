const express = require('express');
const router = express.Router();
const deudasController = require('../controllers/deudasController');

// Ruta para obtener el consolidado de todas tus deudas
// El frontend llamará a: GET /api/deudas/consolidado/:usuarioNombre
router.get('/consolidado/:usuarioNombre', deudasController.getConsolidado);

// Ruta futura para marcar una deuda como pagada
// El frontend llamará a: PATCH /api/deudas/pagar/:deudaId
router.patch('/pagar/:deudaId', deudasController.pagarDeuda);

module.exports = router;
