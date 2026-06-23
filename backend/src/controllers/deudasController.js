const fs = require('fs');
const path = require('path');
const { calcularBalance } = require('../services/balanceService');

function redondear(n) {
    return Math.round(n * 100) / 100;
}

exports.getConsolidado = (req, res) => {
    try {
        const { usuarioNombre } = req.params;
        const dbPath = path.join(__dirname, '../../data/db.json');
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

        const acreedoresAgrupados = {};

        data.juntadas.forEach(juntada => {
            const balance = calcularBalance(juntada);
            
            // Buscamos si el usuario actual pertenece a algún subgrupo/familia en ESTA juntada
            const miSubgrupo = (juntada.subgrupos || []).find(sg => 
                (sg.integrantes || []).some(nombre => nombre.toLowerCase() === usuarioNombre.toLowerCase())
            );

            // Definimos los nombres de la "unidad financiera". 
            // Si está en familia, incluimos a todos para capturar la transferencia asignada al representante.
            const integrantesUnidad = miSubgrupo 
                ? miSubgrupo.integrantes.map(n => n.toLowerCase()) 
                : [usuarioNombre.toLowerCase()];

            // Filtramos las transferencias que deba hacer CUALQUIERA de los miembros de nuestra unidad
            const misPagos = balance.transferencias.filter(t => 
                integrantesUnidad.includes(t.de.toLowerCase())
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
                
                // Agregamos la deuda redondeando para que no exploten los decimales (.000000001)
                acreedoresAgrupados[pago.para].totalAcreedor = redondear(
                    acreedoresAgrupados[pago.para].totalAcreedor + pago.monto
                );
                
                const esDeudaMiaDirecta = pago.de.toLowerCase() === usuarioNombre.toLowerCase();
                const subtitulo = esDeudaMiaDirecta 
                    ? `${usuarioNombre} ➔ ${pago.para}`
                    : `${pago.de} (Familia) ➔ ${pago.para}`;

                acreedoresAgrupados[pago.para].conceptos.push({
                    // Agregamos un número random al final del ID para evitar colisiones si hay montos idénticos
                    id: `${juntada.id}-${pago.para}-${pago.monto}-${Math.floor(Math.random() * 10000)}`,
                    titulo: juntada.nombre,
                    sub: subtitulo,
                    monto: pago.monto,
                    tipo: 'Juntada'
                });
            });
        });

        // Convertimos el objeto de acreedores en un array para el frontend
        const resultado = Object.values(acreedoresAgrupados);

        res.json({ ok: true, data: resultado });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Error interno al procesar el consolidado de deudas.' });
    }
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