export function formatMontoARS(value) {
  const onlyDigits = String(value ?? '').replace(/\D/g, '');
  if (!onlyDigits) return '';
  return Number(onlyDigits).toLocaleString('es-AR');
}

export function parseMontoARS(display) {
  return Number(String(display).replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '')) || 0;
}

export function handleMontoInput(rawText) {
  const stripped = rawText.replace(/^\$\s*/, '');
  const onlyDigits = stripped.replace(/\D/g, '');
  const numeric = Number(onlyDigits) || 0;
  const display = onlyDigits ? Number(onlyDigits).toLocaleString('es-AR') : '';
  return { display, numeric };
}

export function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2);
}

export function labelModelo(modelo) {
  const map = {
    proporcional: 'Proporcional',
    partes_iguales: 'Partes iguales',
    responsable_unico: 'Responsable único',
  };
  return map[modelo] ?? modelo;
}

export function subtituloRegla(regla) {
  if (!regla?.participantes?.length) return '';
  const { modelo, participantes } = regla;
  if (modelo === 'partes_iguales') {
    return `${participantes.map(p => p.nombre).join(' · ')} (partes iguales)`;
  }
  if (modelo === 'responsable_unico') {
    return `${participantes[0].nombre} (100%)`;
  }
  return participantes.map(p => `${p.nombre} ${p.porcentaje ?? 0}%`).join(' · ');
}


export function calcularDivision(total, regla) {
  if (!regla?.participantes?.length || !total) return [];
  const { modelo, participantes } = regla;
  if (modelo === 'partes_iguales') {
    const share = total / participantes.length;
    return participantes.map(p => ({ nombre: p.nombre, monto: share }));
  }
  return participantes.map(p => ({
    nombre: p.nombre,
    monto: total * (p.porcentaje ?? 0) / 100,
  }));
}