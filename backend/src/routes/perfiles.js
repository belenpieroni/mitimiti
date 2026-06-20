const { Router } = require('express');
const ctrl = require('../controllers/perfilController');

const router = Router();

router.get('/:nombre', ctrl.obtenerPerfil);
router.put('/:nombre', ctrl.actualizarPerfil);
router.delete('/:nombre', ctrl.eliminarPerfil);

module.exports = router;
