const fs = require('fs');
const path = require('path');
const { calcularBalance } = require('../services/balanceService');

exports.getConsolidado = (req, res) => {
    
    const { usuarioNombre } = req.params;
    const dbPath = path.join(__dirname, '../../data/db.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

    const acreedoresAgrupados = {};

    data.juntadas.forEach(juntada => {
        const balance = calcularBalance(juntada);
        const miSaldo = balance.saldos.find(s => s.nombre === usuarioNombre);
        
        if (miSaldo && miSaldo.saldo < 0) {
            const misPagos = balance.transferencias.filter(t => t.de === usuarioNombre);
            
            misPagos.forEach(pago => {
                // Si el acreedor no existe en nuestro objeto, lo inicializamos
                if (!acreedoresAgrupados[pago.para]) {
                    acreedoresAgrupados[pago.para] = {
                        id: 'acreedor-' + pago.para,
                        nombre: pago.para,
                        avatar: pago.para.charAt(0).toUpperCase(),
                        totalAcreedor: 0,
                        conceptos: []
                    };
                }
                
                // Agregamos la deuda a este acreedor
                acreedoresAgrupados[pago.para].totalAcreedor += pago.monto;
                acreedoresAgrupados[pago.para].conceptos.push({
                    id: `${juntada.id}-${pago.para}-${pago.monto}-${Date.now()}`,
                    titulo: juntada.nombre,
                    sub: `${usuarioNombre} ➔ ${pago.para}`,
                    monto: pago.monto,
                    tipo: 'Juntada'
                });
            });
        }
    });

    // Convertimos el objeto de acreedores en un array para el frontend
    const resultado = Object.values(acreedoresAgrupados);

    res.json({ ok: true, data: resultado });
};

exports.pagarDeuda = (req, res) => {
    const { deudaId } = req.params;
    res.json({
        ok: true,
        data: {
            deudaId,
            pagada: true,
            mensaje: 'Deuda marcada como pagada'
        }
    });
};