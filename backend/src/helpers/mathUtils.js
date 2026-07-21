/**
 * mathUtils.js
 * ────────────
 * Utilidades matemáticas para el cálculo de deudas y partes de gastos.
 */

function calcularParte(total, cantidad) {
  if (!cantidad || cantidad <= 0) return 0;
  return Math.round((total / cantidad) * 100) / 100;
}

module.exports = { calcularParte };
