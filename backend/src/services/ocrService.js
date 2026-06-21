const { createWorker } = require('tesseract.js');
const Jimp = require('jimp');

/**
 * OCR del lado del SERVIDOR (Node).
 *
 * Soporta DOS motores:
 *  - OCR.space (nube): si está seteada la variable OCR_SPACE_API_KEY.
 *    Lee tickets MUCHO mejor que Tesseract. Plan gratis: https://ocr.space/ocrapi
 *  - Tesseract.js (local): fallback gratuito sin internet/extra. Más impreciso
 *    en fotos de tickets completos.
 *
 * En ambos casos, una vez que tenemos el texto, extraemos el total con la
 * misma lógica (extractAmountFromText).
 */

// ──────────────────────────────────────────────────────────────────────────
// Preprocesado de imagen (mejora la lectura en los dos motores)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Limpia y comprime la imagen. Devuelve { png, jpegBase64 }.
 * - png: buffer PNG limpio (para Tesseract local).
 * - jpegBase64: base64 JPEG liviano (para OCR.space, que limita el tamaño).
 */
async function preprocess(imagePath) {
  const image = await Jimp.read(imagePath);

  // Agrandar si es chica; Tesseract y OCR.space leen mejor texto grande.
  if (image.bitmap.width < 1400) {
    image.scale(1400 / image.bitmap.width);
  }
  // Pero no mandar algo gigante a la nube (límite de tamaño del plan free).
  if (image.bitmap.width > 1600) {
    image.resize(1600, Jimp.AUTO);
  }

  image.greyscale().contrast(0.4).normalize();

  const png = await image.getBufferAsync(Jimp.MIME_PNG);
  image.quality(70);
  const jpegBuf = await image.getBufferAsync(Jimp.MIME_JPEG);
  return { png, jpegBase64: jpegBuf.toString('base64') };
}

// ──────────────────────────────────────────────────────────────────────────
// Motor 1: OCR.space (nube)
// ──────────────────────────────────────────────────────────────────────────

async function ocrSpace(jpegBase64) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch no disponible (se requiere Node 18+)');
  }

  const body = new URLSearchParams();
  body.append('base64Image', `data:image/jpeg;base64,${jpegBase64}`);
  body.append('language', 'spa');
  body.append('OCREngine', '2');       // motor 2: mejor con fotos
  body.append('scale', 'true');
  body.append('isTable', 'true');      // ayuda con el layout de tickets
  body.append('detectOrientation', 'true');

  const resp = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      apikey: process.env.OCR_SPACE_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await resp.json();
  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(' ') : json.ErrorMessage;
    throw new Error('OCR.space: ' + msg);
  }
  return json.ParsedResults?.[0]?.ParsedText || '';
}

// ──────────────────────────────────────────────────────────────────────────
// Motor 2: Tesseract.js (local)
// ──────────────────────────────────────────────────────────────────────────

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    const options = {};
    if (process.env.TESS_LANG_PATH) {
      options.langPath = process.env.TESS_LANG_PATH;
      options.gzip = true;
    }
    workerPromise = createWorker('spa', 1, options)
      .then(async (worker) => {
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        return worker;
      })
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

async function tesseract(pngBuffer) {
  const worker = await getWorker();
  const result = await worker.recognize(pngBuffer);
  return result.data.text || '';
}

// ──────────────────────────────────────────────────────────────────────────
// Texto -> total
// ──────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un string de monto a número.
 * Maneja "58,50", "1.234,50" (AR/ES) y "58.50", "1,234.50" (US).
 */
function parseMonto(raw) {
  let s = String(raw).trim();
  const tienePunto = s.includes('.');
  const tieneComa = s.includes(',');

  if (tienePunto && tieneComa) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (tieneComa) {
    s = s.replace(',', '.');
  }

  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
}

/**
 * Extrae el importe total del texto de un ticket.
 * - Solo números con 2 decimales (descarta teléfonos, CIF, fechas, cantidades).
 * - Prioriza la línea con "total" (ignorando "subtotal").
 * - Si no hay "total", cae al mayor monto del ticket.
 */
function extractAmountFromText(text) {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const totalAmounts = [];
  const allAmounts = [];
  const numRe = /(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/g;

  for (const line of lines) {
    const low = line.toLowerCase();
    const esTotal = /total/.test(low) && !/sub\s*total/.test(low);

    let m;
    while ((m = numRe.exec(line)) !== null) {
      const val = parseMonto(m[1]);
      if (val == null || val <= 0 || val >= 1000000) continue;
      allAmounts.push(val);
      if (esTotal) totalAmounts.push(val);
    }
  }

  if (totalAmounts.length > 0) return Math.max(...totalAmounts);
  if (allAmounts.length > 0) return Math.max(...allAmounts);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────────────

/**
 * Saca el texto de la imagen usando el mejor motor disponible.
 */
async function extractTextFromImage(imagePath) {
  const { png, jpegBase64 } = await preprocess(imagePath);

  if (process.env.OCR_SPACE_API_KEY) {
    try {
      const text = await ocrSpace(jpegBase64);
      if (text && text.trim()) return text;
      console.warn('OCR.space devolvió vacío, uso Tesseract como respaldo.');
    } catch (e) {
      console.warn('OCR.space falló, uso Tesseract como respaldo:', e.message);
    }
  }

  return tesseract(png);
}

/**
 * Escanea un ticket: OCR + extracción del importe.
 * @param {string} imagePath
 * @returns {Promise<{ amount: number|null, text: string }>}
 */
async function scanTicket(imagePath) {
  const text = await extractTextFromImage(imagePath);
  const amount = extractAmountFromText(text);
  return { amount, text };
}

async function terminateWorker() {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch (_) {
      /* ignorar */
    }
    workerPromise = null;
  }
}

module.exports = {
  extractTextFromImage,
  extractAmountFromText,
  parseMonto,
  scanTicket,
  terminateWorker,
};