const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const { calcularBalance } = require('../services/balanceService');

const dbPath = path.join(__dirname, '../../data/db.json');

function leerDB() {
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function escribirDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

exports.getConsolidado = (req, res) => {
    
    const { usuarioNombre } = req.params;
    const data = leerDB();

    const acreedoresAgrupados = {};

    data.juntadas.forEach(juntada => {
        const balance = calcularBalance(juntada);
        const miSaldo = balance.saldos.find(
            s => s.nombre.toLowerCase() === usuarioNombre.toLowerCase()
        );
        
        if (miSaldo && miSaldo.saldoPendiente < 0) {
            const misPagos = balance.transferencias.filter(
                t => t.de.toLowerCase() === usuarioNombre.toLowerCase()
            );
            
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
                    id: `${juntada.id}::${encodeURIComponent(pago.de)}::${encodeURIComponent(pago.para)}`,
                    titulo: juntada.nombre,
                    sub: `${usuarioNombre} ➔ ${pago.para}`,
                    monto: pago.monto,
                    tipo: 'Juntada',
                    juntadaId: juntada.id,
                    deudor: pago.de,
                    acreedor: pago.para,
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
    const partes = deudaId.split('::');

    if (partes.length !== 3) {
        return res.status(400).json({
            ok: false,
            error: 'Formato de deuda inválido.'
        });
    }

    const [juntadaId, deudorEnc, acreedorEnc] = partes;
    const deudor = decodeURIComponent(deudorEnc);
    const acreedor = decodeURIComponent(acreedorEnc);

    const data = leerDB();
    const juntada = data.juntadas.find(j => j.id === juntadaId);

    if (!juntada) {
        return res.status(404).json({ ok: false, error: 'Juntada no encontrada.' });
    }

    const balance = calcularBalance(juntada);
    const transferenciaPendiente = balance.transferencias.find(
        t => t.de.toLowerCase() === deudor.toLowerCase() && t.para.toLowerCase() === acreedor.toLowerCase()
    );

    if (!transferenciaPendiente) {
        return res.json({
            ok: true,
            data: {
                deudaId,
                pagada: true,
                mensaje: 'La deuda ya estaba saldada.'
            }
        });
    }

    if (!Array.isArray(juntada.pagosDeudas)) {
        juntada.pagosDeudas = [];
    }

    const pago = {
        id: uuidv4(),
        de: transferenciaPendiente.de,
        para: transferenciaPendiente.para,
        monto: transferenciaPendiente.monto,
        creadoEn: new Date().toISOString(),
    };

    juntada.pagosDeudas.push(pago);
    escribirDB(data);

    res.json({
        ok: true,
        data: {
            deudaId,
            pagada: true,
            pago,
            mensaje: 'Deuda marcada como pagada'
        }
    });
};