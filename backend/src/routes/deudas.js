const express = require('express');
const router = express.Router();
const deudasController = require('../controllers/deudasController');

router.get('/consolidado/:usuarioNombre', deudasController.getConsolidado);
router.patch('/pagar/:deudaId', deudasController.pagarDeuda);
router.post('/pagar_multiple', deudasController.pagarMultiple);

module.exports = router;