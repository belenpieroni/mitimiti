const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/device-token', requireAuth, authController.registrarDeviceToken);
router.get('/notification-preferences', requireAuth, authController.obtenerPreferenciasNotificaciones);
router.put('/notification-preferences', requireAuth, authController.actualizarPreferenciasNotificaciones);
router.get('/notifications', requireAuth, authController.listarNotificaciones);
router.patch('/notifications/:id/read', requireAuth, authController.marcarNotificacionLeida);
router.patch('/notifications/read-all', requireAuth, authController.marcarTodasLeidas);
router.post('/push-test', requireAuth, authController.enviarPushPrueba);

module.exports = router;