/**
 * balanceService.js
 * ─────────────────
 * Lógica de negocio central de Miti Miti (Versión Familiar por Consumo)
 */
 
/**
 * Redondea a 2 decimales para evitar errores de punto flotante.
 */
function redondear(n) {
  return Math.round(n * 100) / 100;
}
 
/**
 * Dado un objeto juntada (con participantes, gastos y subgrupos), calcula:
 * - totalGastado
 * - saldos: array con deudas consolidadas por grupo familiar (sin deudas internas)
 * - transferencias: lista mínima de pagos entre familias/unidades
 */
function calcularBalance(juntada) {
  const { participantes = [], gastos = [], subgrupos = [] } = juntada;
  const n = participantes.length;
 
  const totalGastado = gastos.reduce((sum, g) => sum + g.monto, 0);
 
  // Trackers individuales iniciales de consumo y pago real
  const pagadoPor = {};
  const correspondePor = {};

  participantes.forEach((p) => {
    pagadoPor[p.nombre] = 0;
    correspondePor[p.nombre] = 0;
  });

  // 1. PROCESAR CADA GASTO SEGÚN CONSUMO REAL (Checklist de beneficiarios)
  gastos.forEach((g) => {
    // Acreditar el pago a la persona física que puso la plata
    if (pagadoPor[g.pagador] !== undefined) {
      pagadoPor[g.pagador] = redondear(pagadoPor[g.pagador] + g.monto);
    }

    // Sistema de Checklist: si viene el array 'beneficiarios' con gente tildada, se usa.
    // Si no viene (gastos viejos o división total), cae en el fallback de dividir entre todos.
    const consumidores = g.beneficiarios && g.beneficiarios.length > 0 
      ? g.beneficiarios 
      : participantes.map(p => p.nombre);
      
    if (consumidores.length > 0) {
      // Costo por cabeza real que consumió este ítem específico
      const cuotaPorCabeza = g.monto / consumidores.length;
      
      consumidores.forEach(nombreConsumidor => {
        if (correspondePor[nombreConsumidor] !== undefined) {
          correspondePor[nombreConsumidor] += cuotaPorCabeza;
        }
      });
    }
  });

  // 2. CONSOLIDACIÓN FAMILIAR (El truco mágico)
  // Para evitar deudas internas, sumamos todo lo pagado y consumido del núcleo 
  // y se lo asignamos a un "Representante" (el que más pagó). Los demás miembros quedan en 0.
  const pagadoConsolidado = { ...pagadoPor };
  const correspondeConsolidado = { ...correspondePor };

  subgrupos.forEach(sg => {
    const integrantes = sg.integrantes || [];
    if (integrantes.length <= 1) return; // Si es un colado solo, no hay nada que consolidar

    // Elegimos al representante de la familia: el que haya puesto más plata físicamente.
    // Si nadie puso un peso todavía, elegimos al primero de la lista por defecto.
    let representante = integrantes[0];
    let maxPagado = -1;
    integrantes.forEach(nombre => {
      if (pagadoPor[nombre] > maxPagado) {
        maxPagado = pagadoPor[nombre];
        representante = nombre;
      }
    });

    let grupoTotalPagado = 0;
    let grupoTotalCorresponde = 0;

    // Sumamos los totales del núcleo familiar
    integrantes.forEach(nombre => {
      grupoTotalPagado += pagadoPor[nombre] || 0;
      grupoTotalCorresponde += correspondePor[nombre] || 0;
      
      // Limpiamos la cuenta de los demás integrantes para que no figuren con deudas
      if (nombre !== representante) {
        pagadoConsolidado[nombre] = 0;
        correspondeConsolidado[nombre] = 0;
      }
    });

    // El representante absorbe la economía entera de su familia para la liquidación
    pagadoConsolidado[representante] = grupoTotalPagado;
    correspondeConsolidado[representante] = grupoTotalCorresponde;
  });
 
  // 3. GENERAR SALDOS FINALES LIMPIOS
  const saldos = participantes.map((p) => {
    const pagado = redondear(pagadoConsolidado[p.nombre] || 0);
    const corresponde = redondear(correspondeConsolidado[p.nombre] || 0);
    const saldo = redondear(pagado - corresponde);

    return {
      nombre: p.nombre,
      iniciales: p.iniciales,
      color: p.color,
      pagado,
      corresponde,
      saldo, // positivo -> acreedor, negativo -> deudor, cero -> al día con su familia
    };
  });
 
  // El algoritmo greedy ahora solo procesará deudas entre representantes y sueltos
  const transferencias = calcularLiquidacion(saldos);
 
  const parteIgual = n > 0 ? redondear(totalGastado / n) : 0;

  return {
    totalGastado,
    parteIgualPorPersona: parteIgual, // Queda como dato informativo general
    cantidadParticipantes: n,
    saldos,
    transferencias,
  };
}
 
/**
 * Algoritmo greedy de liquidación eficiente (Se mantiene intacto y funcional)
 */
function calcularLiquidacion(saldos) {
  const balances = saldos.map((s) => ({
    nombre: s.nombre,
    saldo: s.saldo,
  }));
 
  const transferencias = [];
  const EPSILON = 0.01;
 
  for (let i = 0; i < 1000; i++) {
    balances.sort((a, b) => a.saldo - b.saldo);
 
    const deudor = balances[0];
    const acreedor = balances[balances.length - 1];
 
    if (acreedor.saldo < EPSILON || deudor.saldo > -EPSILON) break;
 
    const monto = redondear(Math.min(Math.abs(deudor.saldo), acreedor.saldo));
 
    transferencias.push({
      de: deudor.nombre,
      para: acreedor.nombre,
      monto,
    });
 
    deudor.saldo = redondear(deudor.saldo + monto);
    acreedor.saldo = redondear(acreedor.saldo - monto);
  }
 
  return transferencias;
}
 
/**
 * Calcula el saldo global de un participante. Al usar la misma función consolidada,
 * mantiene el historial impecable sin falsas deudas globales en el Home.
 */
function calcularBalanceGlobal(nombreParticipante, juntadas) {
  let porCobrar = 0;
  let porPagar = 0;
 
  juntadas.forEach((juntada) => {
    const balance = calcularBalance(juntada);
    const saldo = balance.saldos.find((s) => s.nombre === nombreParticipante);
    if (!saldo) return;
 
    if (saldo.saldo > 0) porCobrar = redondear(porCobrar + saldo.saldo);
    if (saldo.saldo < 0) porPagar = redondear(porPagar + Math.abs(saldo.saldo));
  });
 
  return {
    porCobrar,
    porPagar,
    total: redondear(porCobrar - porPagar),
  };
}
 
module.exports = { calcularBalance, calcularLiquidacion, calcularBalanceGlobal };