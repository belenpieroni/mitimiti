/**
 * balanceService.js
 * ─────────────────
 * Lógica de negocio central de Miti Miti:
 *
 *  1. calcularBalance(juntada)
 *     → División equitativa: total gastado / cantidad de participantes.
 *     → Devuelve cuánto pagó cada uno vs. lo que le correspondía pagar.
 *
 *  2. calcularLiquidacion(saldos)
 *     → Algoritmo greedy de liquidación eficiente:
 *        minimiza la cantidad de transferencias necesarias para saldar todas las deudas.
 *     → Devuelve un array de { de, para, monto }.
 */
 
/**
 * Redondea a 2 decimales para evitar errores de punto flotante.
 * Ej: 1666.6666666667 → 1666.67
 */
function redondear(n) {
  return Math.round(n * 100) / 100;
}

function clavePar(de, para) {
  return `${de}__${para}`;
}

function aplicarPagosATransferencias(transferencias, pagosDeudas = []) {
  const pagosRestantes = new Map();

  pagosDeudas.forEach((p) => {
    if (!p?.de || !p?.para || typeof p.monto !== 'number' || p.monto <= 0) return;
    const key = clavePar(p.de, p.para);
    const actual = pagosRestantes.get(key) || 0;
    pagosRestantes.set(key, redondear(actual + p.monto));
  });

  const pendientes = [];
  transferencias.forEach((t) => {
    const key = clavePar(t.de, t.para);
    const pagoDisponible = pagosRestantes.get(key) || 0;
    const usado = redondear(Math.min(pagoDisponible, t.monto));
    const pendiente = redondear(t.monto - usado);

    if (usado > 0) {
      pagosRestantes.set(key, redondear(pagoDisponible - usado));
    }

    if (pendiente > 0.01) {
      pendientes.push({ ...t, monto: pendiente });
    }
  });

  return pendientes;
}
 
/**
 * Dado un objeto juntada (con participantes y gastos), calcula:
 *  - totalGastado
 *  - parteIgualPorPersona (cuánto le toca a cada uno)
 *  - saldos: array con { nombre, pagado, corresponde, saldo }
 *      saldo > 0 → le deben (acreedor)
 *      saldo < 0 → debe (deudor)
 *  - transferencias: lista mínima de pagos para saldar todo
 *
 * @param {Object} juntada
 * @returns {Object} balance
 */
function calcularBalance(juntada) {
  const { participantes = [], gastos = [], subgrupos = [], pagosDeudas = [] } = juntada;
  const n = participantes.length;
 
  const totalGastado = gastos.reduce((sum, g) => sum + g.monto, 0);
  const parteIgual = n > 0 ? redondear(totalGastado / n) : 0;
 
  // Cuánto pagó cada participante
  const pagadoPor = {};
  const correspondePor = {};

  participantes.forEach((p) => {
    pagadoPor[p.nombre] = 0;
    correspondePor[p.nombre] = 0;
  });

  gastos.forEach((g) => {
    if (pagadoPor[g.pagador] !== undefined) {
      pagadoPor[g.pagador] = redondear(pagadoPor[g.pagador] + g.monto);
    }
    // Si el pagador no está en la lista de participantes lo ignoramos (dato inconsistente)

    if (g.splitMode === 'subgroups' && g.splitSubgroups && g.splitSubgroups.length > 0) {
      const gruposSeleccionados = subgrupos.filter(s => g.splitSubgroups.includes(s.id));
      
      if (gruposSeleccionados.length > 0) {
        const cuotaPorGrupo = g.monto / gruposSeleccionados.length;
        
        gruposSeleccionados.forEach(sg => {
          const cuotaIndividual = cuotaPorGrupo / sg.integrantes.length;
          sg.integrantes.forEach(nombreInt => {
            if (correspondePor[nombreInt] !== undefined) {
              correspondePor[nombreInt] += cuotaIndividual;
            }
          });
        });
      }
    } else {
      const cuotaIgual = g.monto / n;
      participantes.forEach(p => {
        correspondePor[p.nombre] += cuotaIgual;
      });
    }
  });
 
  // Saldo neto de cada participante
  const saldos = participantes.map((p) => {
    const pagado = pagadoPor[p.nombre] || 0;
    const corresponde = redondear(correspondePor[p.nombre] || 0);
    const saldo = redondear(pagado - corresponde);

    return {
      nombre: p.nombre,
      iniciales: p.iniciales,
      color: p.color,
      pagado,
      corresponde,
      saldo, // positivo → acreedor, negativo → deudor
    };
  });
 
  const transferenciasOriginales = calcularLiquidacion(saldos);
  const transferencias = aplicarPagosATransferencias(transferenciasOriginales, pagosDeudas);

  const saldoPendientePor = {};
  participantes.forEach((p) => {
    saldoPendientePor[p.nombre] = 0;
  });

  transferencias.forEach((t) => {
    if (saldoPendientePor[t.de] !== undefined) {
      saldoPendientePor[t.de] = redondear(saldoPendientePor[t.de] - t.monto);
    }
    if (saldoPendientePor[t.para] !== undefined) {
      saldoPendientePor[t.para] = redondear(saldoPendientePor[t.para] + t.monto);
    }
  });

  const saldosConPendiente = saldos.map((s) => ({
    ...s,
    saldoPendiente: redondear(saldoPendientePor[s.nombre] || 0),
  }));
 
  return {
    totalGastado,
    parteIgualPorPersona: parteIgual,
    cantidadParticipantes: n,
    saldos: saldosConPendiente,
    transferenciasOriginales,
    transferencias,
  };
}
 
/**
 * Algoritmo greedy de liquidación eficiente.
 *
 * Estrategia:
 *  - Ordenar de menor a mayor saldo.
 *  - El primer elemento (más negativo) es el mayor deudor.
 *  - El último elemento (más positivo) es el mayor acreedor.
 *  - Se crea una transferencia por min(|deuda|, crédito).
 *  - Se ajustan los saldos y se repite hasta que todos sean ~0.
 *
 * Esto produce la cantidad mínima de transacciones posibles.
 *
 * @param {Array} saldos - Array de { nombre, saldo }
 * @returns {Array} transferencias - Array de { de, para, monto }
 */
function calcularLiquidacion(saldos) {
  // Trabajamos con una copia profunda para no mutar el array original
  const balances = saldos.map((s) => ({
    nombre: s.nombre,
    saldo: s.saldo,
  }));
 
  const transferencias = [];
  const EPSILON = 0.01; // tolerancia para evitar micro-deudas por punto flotante
 
  for (let i = 0; i < 1000; i++) {
    // Ordenar: menor (deudor) primero, mayor (acreedor) último
    balances.sort((a, b) => a.saldo - b.saldo);
 
    const deudor = balances[0];
    const acreedor = balances[balances.length - 1];
 
    // Condición de parada: nadie debe ni se le debe nada relevante
    if (acreedor.saldo < EPSILON || deudor.saldo > -EPSILON) break;
 
    const monto = redondear(Math.min(Math.abs(deudor.saldo), acreedor.saldo));
 
    transferencias.push({
      de: deudor.nombre,
      para: acreedor.nombre,
      monto,
    });
 
    // Ajustar saldos
    deudor.saldo = redondear(deudor.saldo + monto);
    acreedor.saldo = redondear(acreedor.saldo - monto);
  }
 
  return transferencias;
}
 
/**
 * Calcula el saldo global de un participante (por nombre) a través
 * de TODAS sus juntadas. Útil para el HomeScreen / BalanceScreen global.
 *
 * @param {string} nombreParticipante
 * @param {Array}  juntadas
 * @returns {{ porCobrar: number, porPagar: number, total: number }}
 */
function calcularBalanceGlobal(nombreParticipante, juntadas) {
  let porCobrar = 0;
  let porPagar = 0;
 
  juntadas.forEach((juntada) => {
    const balance = calcularBalance(juntada);
    const saldo = balance.saldos.find((s) => s.nombre === nombreParticipante);
    if (!saldo) return;

    const saldoNeto = typeof saldo.saldoPendiente === 'number' ? saldo.saldoPendiente : saldo.saldo;
 
    if (saldoNeto > 0) porCobrar = redondear(porCobrar + saldoNeto);
    if (saldoNeto < 0) porPagar = redondear(porPagar + Math.abs(saldoNeto));
  });
 
  return {
    porCobrar,
    porPagar,
    total: redondear(porCobrar - porPagar),
  };
}
 
module.exports = { calcularBalance, calcularLiquidacion, calcularBalanceGlobal };