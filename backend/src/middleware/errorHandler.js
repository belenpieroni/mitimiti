// Captura errores que los controladores pasan con next(err)
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Error interno del servidor' });
}

// Se ejecuta cuando nadie respondió la petición (ruta no encontrada)
function notFound(req, res) {
  res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };