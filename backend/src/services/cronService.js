const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');

const DB_PATH = path.join(__dirname, '../../data/db.json');

function leerDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function escribirDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function sumarFrecuencia(fecha, periodicidad) {
  const date = new Date(fecha);
  switch (periodicidad.toLowerCase()) {
    case 'semanal': date.setDate(date.getDate() + 7); break;
    case 'mensual': date.setMonth(date.getMonth() + 1); break;
    case 'bimestral': date.setMonth(date.getMonth() + 2); break;
    case '6 meses': date.setMonth(date.getMonth() + 6); break;
    case 'anual': date.setFullYear(date.getFullYear() + 1); break;
  }
  return date.toISOString();
}

function procesarServiciosPeriodicos() {
  try {
    const db = leerDB();
    if (!db.vivienda || !db.vivienda.serviciosPeriodicos) return;

    const ahora = new Date();
    let modificado = false;

    for (let servicio of db.vivienda.serviciosPeriodicos) {
      const vencimiento = new Date(servicio.proximoVencimiento);
      if (ahora >= vencimiento) {
        // Generar el gasto automático
        const nuevoGasto = {
          id: uuidv4(),
          nombre: servicio.nombre,
          monto: servicio.monto,
          categoria: 'Hogar', // Default para servicios
          fecha: new Date().toISOString(),
          pagador: 'Martín', // Usuario default para MVP
          participantes: servicio.participantes || []
        };
        db.vivienda.gastos.push(nuevoGasto);

        // Actualizar la fecha del próximo vencimiento
        servicio.proximoVencimiento = sumarFrecuencia(servicio.proximoVencimiento, servicio.periodicidad);
        modificado = true;
      }
    }

    if (modificado) {
      escribirDB(db);
      console.log('Servicios periódicos procesados y gastos generados automáticamente.');
    }
  } catch (error) {
    console.error('Error al procesar servicios periódicos:', error);
  }
}

function iniciarCron() {
  console.log('Servicio cron de vivienda iniciado.');
  // Ejecutar inmediatamente al inicio
  procesarServiciosPeriodicos();
  
  // Ejecutar cada 24 horas (86400000 ms)
  setInterval(procesarServiciosPeriodicos, 86400000);
}

module.exports = { iniciarCron, procesarServiciosPeriodicos };
