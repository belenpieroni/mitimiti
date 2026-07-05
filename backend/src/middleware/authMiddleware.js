const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ ok: false, error: 'Token de autorización requerido.' });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'mitimiti_seguro_2026'
    );

    req.user = {
      id: payload.id,
      email: payload.email,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado.' });
  }
}

module.exports = { requireAuth };