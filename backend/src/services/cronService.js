const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const {
  notifyUsersByName,
  NOTIFICATION_CATEGORIES,
} = require('./pushNotificationService');

const DB_PATH = path.join(__dirname, '../../data/db.json');

function leerDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function escribirDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function asegurarInfraNotificaciones(db) {
  if (!db.notificaciones || typeof db.notificaciones !== 'object') {
    db.notificaciones = {};
  }
  if (!Array.isArray(db.notificaciones.recordatorios48hEnviados)) {
    db.notificaciones.recordatorios48hEnviados = [];
  }
}

async function procesarRecordatorios48h(db) {
  if (!db.vivienda || !Array.isArray(db.vivienda.serviciosPeriodicos)) {
    return false;
  }

  asegurarInfraNotificaciones(db);

  const ahora = new Date();
  const dosDiasMs = 48 * 60 * 60 * 1000;
  const ventanaMs = 24 * 60 * 60 * 1000;
  let huboCambios = false;

  for (const servicio of db.vivienda.serviciosPeriodicos) {
    if (!servicio.proximoVencimiento) {
      continue;
    }

    const vencimiento = new Date(servicio.proximoVencimiento);
    const diffMs = vencimiento.getTime() - ahora.getTime();

    const estaEnVentana48h = diffMs <= dosDiasMs && diffMs > dosDiasMs - ventanaMs;
    if (!estaEnVentana48h) {
      continue;
    }

    const recordatorioKey = `${servicio.id || servicio.nombre}|${vencimiento.toISOString().slice(0, 10)}`;
    if (db.notificaciones.recordatorios48hEnviados.includes(recordatorioKey)) {
      continue;
    }

    const destinatarios = Array.isArray(servicio.participantes) ? servicio.participantes : [];

    if (destinatarios.length > 0) {
      await notifyUsersByName(db, destinatarios, {
        title: 'Recordatorio de vencimiento',
        body: `${servicio.nombre} vence en menos de 48 horas.`,
        data: {
          type: 'servicio_due_48h',
          servicioId: String(servicio.id || ''),
          servicioNombre: String(servicio.nombre || ''),
          fechaVencimiento: vencimiento.toISOString(),
        },
      }, {
        category: NOTIFICATION_CATEGORIES.RECORDATORIOS_VENCIMIENTO,
      });
    }

    db.notificaciones.recordatorios48hEnviados.push(recordatorioKey);
    huboCambios = true;
  }

  return huboCambios;
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

async function procesarServiciosPeriodicos() {
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

    const recordatoriosNuevos = await procesarRecordatorios48h(db);

    if (modificado || recordatoriosNuevos) {
      escribirDB(db);
      console.log('Servicios periodicos procesados y recordatorios evaluados.');
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
