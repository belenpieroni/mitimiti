/**
 * balanceService.js
 * ─────────────────
 * Lógica de negocio central de Miti Miti (Versión Familiar por Consumo + Subgrupos Variables)
 */
 
/**
 * Redondea a 2 decimales para evitar errores de punto flotante.
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
 * Dado un objeto juntada (con participantes, gastos y subgrupos), calcula:
 * - totalGastado
 * - saldos: array con deudas consolidadas por grupo familiar (sin deudas internas)
 * - transferencias: lista mínima de pagos entre familias/unidades
 */
function calcularBalance(juntada) {
  const { participantes = [], gastos = [], subgrupos = [], pagosDeudas = [] } = juntada;
  const n = participantes.length;
 
  const totalGastado = gastos.reduce((sum, g) => sum + g.monto, 0);
 
  // Trackers individuales iniciales de consumo y pago real
  const pagadoPor = {};
  const correspondePor = {};

  participantes.forEach((p) => {
    pagadoPor[p.nombre] = 0;
    correspondePor[p.nombre] = 0;
  });

  // 1. PROCESAR CADA GASTO SEGÚN CONSUMO REAL (CA3: Soporte para Subgrupos Dinámicos)
  gastos.forEach((g) => {
    // Acreditar el pago a la persona física que puso la plata
    if (pagadoPor[g.pagador] !== undefined) {
      pagadoPor[g.pagador] = redondear(pagadoPor[g.pagador] + g.monto);
    }

    let consumidores = [];

    // GASTO POR SUBGRUPOS (Criterio de Aceptación 3)
    if (g.tipoDivision === 'subgrupos' && g.subgruposIds && g.subgruposIds.length > 0) {
      const setIntegrantesUnicos = new Set();
      
      // Buscamos los subgrupos seleccionados en este gasto dentro del array de la juntada
      const sgAsignados = subgrupos.filter(sg => g.subgruposIds.includes(sg.id));
      
      sgAsignados.forEach(sg => {
        const integrantesActivos = sg.integrantes || [];
        // Se extraen los usuarios reales en este preciso instante
        integrantesActivos.forEach(nombre => setIntegrantesUnicos.add(nombre));
      });

      consumidores = Array.from(setIntegrantesUnicos);

    } else if (g.beneficiarios && g.beneficiarios.length > 0) {
      // Sistema clásico de Checklist individual
      consumidores = g.beneficiarios;
    } else {
      // Fallback: división general entre todos
      consumidores = participantes.map(p => p.nombre);
    }
      
    // VALIDACIÓN MATEMÁTICA CRÍTICA (CA3): Si el subgrupo está vacío en este instante, 
    // su length es 0. Al validar > 0 evitamos la división por cero (monto / 0 = Infinity/NaN)
    if (consumidores.length > 0) {
      const cuotaPorCabeza = g.monto / consumidores.length;
      
      consumidores.forEach(nombreConsumidor => {
        if (correspondePor[nombreConsumidor] !== undefined) {
          correspondePor[nombreConsumidor] += cuotaPorCabeza;
        }
      });
    }
  });

  // 2. CONSOLIDACIÓN FAMILIAR (Filtrado de seguridad)
  const pagadoConsolidado = { ...pagadoPor };
  const correspondeConsolidado = { ...correspondePor };

  subgrupos.forEach(sg => {
    // REGLA DE SEGURIDAD: Solo consolidamos si el subgrupo está marcado explícitamente como familiar/núcleo.
    // Si es un subgrupo de consumo variable (asado, bebidas), saltamos la consolidación.
    if (sg.tipo !== 'familiar') return; 
    
    const integrantes = sg.integrantes || [];
    if (integrantes.length <= 1) return;

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

    integrantes.forEach(nombre => {
      grupoTotalPagado += pagadoPor[nombre] || 0;
      grupoTotalCorresponde += correspondePor[nombre] || 0;
      
      if (nombre !== representante) {
        pagadoConsolidado[nombre] = 0;
        correspondeConsolidado[nombre] = 0;
      }
    });

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
      saldo,
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
 
  const parteIgual = n > 0 ? redondear(totalGastado / n) : 0;

  return {
    totalGastado,
    parteIgualPorPersona: parteIgual,
    cantidadParticipantes: juntada.participantes.length,
    saldos: saldosConPendiente,
    transferenciasOriginales,
    transferencias,
  };
}
 
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
    acreedor.saldo = redondear-acreedor.saldo - monto;
    acreedor.saldo = redondear(acreedor.saldo - monto);
  }
 
  return transferencias;
}
 
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