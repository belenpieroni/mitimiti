

function calcularParte(total, cantidad) {
  if (!cantidad || cantidad <= 0) return 0;
  return Math.round((total / cantidad) * 100) / 100;
}

module.exports = { calcularParte };
