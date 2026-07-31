
/**
 * balanceService.js
 * ─────────────────
 * Lógica de negocio central de Miti Miti (Versión Familiar por Consumo + Subgrupos Variables)
 */
 
const { calcularParte } = require('../helpers/mathUtils');


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
 

function calcularBalance(juntada) {
  const { participantes = [], gastos = [], subgrupos = [], pagosDeudas = [] } = juntada;
  const n = participantes.length;
 
  const totalGastado = gastos.reduce((sum, g) => sum + g.monto, 0);
 
  
  const pagadoPor = {};
  const correspondePor = {};

  const nombreMap = {};
  participantes.forEach((p) => {
    pagadoPor[p.nombre] = 0;
    correspondePor[p.nombre] = 0;
    nombreMap[p.nombre.toLowerCase()] = p.nombre;
  });

  
  gastos.forEach((g) => {
    
    const pagadorNormalizado = g.pagador ? g.pagador.trim().toLowerCase() : '';
    const pagadorOriginal = nombreMap[pagadorNormalizado];
    if (pagadorOriginal && pagadoPor[pagadorOriginal] !== undefined) {
      pagadoPor[pagadorOriginal] = redondear(pagadoPor[pagadorOriginal] + g.monto);
    }

    let consumidores = [];
    if (g.beneficiarios && g.beneficiarios.length > 0) {
      consumidores = g.beneficiarios;
    } else if (g.splitMode === 'subgroups' && Array.isArray(g.splitSubgroups) && g.splitSubgroups.length > 0) {
      const integrantes = new Set();
      g.splitSubgroups.forEach((subgroupId) => {
        const sg = subgrupos.find((group) => group.id === subgroupId);
        if (sg?.integrantes?.length > 0) {
          sg.integrantes.forEach((nombre) => integrantes.add(nombre));
        }
      });
      consumidores = Array.from(integrantes);
    } else {
      consumidores = participantes.map(p => p.nombre);
    }

    consumidores = consumidores
      .map(c => nombreMap[c ? c.trim().toLowerCase() : ''])
      .filter(Boolean);

      if (consumidores.length > 0) {
        const calcularDivision = (total, cantidad) => {
          if (cantidad === 0) return [];
          const totalCentavos = Math.round(total * 100);
          const cuotaBaseCentavos = Math.floor(totalCentavos / cantidad);
          let restoCentavos = totalCentavos - (cuotaBaseCentavos * cantidad);
          
          const distribucion = [];
          for (let i = 0; i < cantidad; i++) {
            let cuota = cuotaBaseCentavos;
            if (restoCentavos > 0) {
              cuota += 1;
              restoCentavos -= 1;
            }
            distribucion.push(cuota / 100);
          }
          return distribucion;
        };

        const cuotas = calcularDivision(g.monto, consumidores.length);
        
        consumidores.forEach((nombreConsumidor, index) => {
          if (correspondePor[nombreConsumidor] !== undefined) {
            correspondePor[nombreConsumidor] += cuotas[index];
          }
        });
      }
  });

  const pagadoConsolidado = { ...pagadoPor };
  const correspondeConsolidado = { ...correspondePor };

  subgrupos.forEach(sg => {
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
 
  const saldos = participantes.map((p) => {
    const pagado = redondear(pagadoConsolidado[p.nombre] || 0);
    const corresponde = redondear(correspondeConsolidado[p.nombre] || 0);
    const saldo = redondear(pagado - corresponde);

    return {
      nombre: p.nombre,
      iniciales: p.iniciales,
      color: p.color,
      alias: p.alias,
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
 
  const parteIgual = calcularParte(totalGastado, n);

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
  let porPagar  = 0;
 
  juntadas.forEach((juntada) => {
    const balance = calcularBalance(juntada);
    const saldo   = balance.saldos.find((s) => s.nombre.trim().toLowerCase() === nombreParticipante.trim().toLowerCase());
    if (!saldo) return;

    const saldoPendiente = typeof saldo.saldoPendiente === 'number' ? saldo.saldoPendiente : null;
    const saldoBruto     = saldo.saldo ?? 0;
    const saldoNeto      = (saldoPendiente !== null && saldoPendiente !== 0)
      ? saldoPendiente
      : saldoBruto;

    if (saldoNeto > 0.01)  porCobrar = redondear(porCobrar + saldoNeto);
    if (saldoNeto < -0.01) porPagar  = redondear(porPagar  + Math.abs(saldoNeto));
  });
 
  return {
    porCobrar,
    porPagar,
    total: redondear(porCobrar - porPagar),
  };
}
 
module.exports = { calcularBalance, calcularLiquidacion, calcularBalanceGlobal };