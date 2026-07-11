const { createWorker } = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs');
const pdfjsLib = require('pdfjs-dist');

/**
 * OCR del lado del SERVIDOR (Node).
 *
 * Soporta DOS motores:
 *  - OCR.space (nube): si está seteada la variable OCR_SPACE_API_KEY.
 *  - Tesseract.js (local): fallback gratuito sin internet/extra.
 *
 * Lógica de extracción:
 *  - Recolecta TODOS los montos asociados a "total" / "a pagar" en la boleta.
 *  - Si hay uno solo → lo devuelve.
 *  - Si hay varios  → devuelve el MENOR (el 1° vencimiento siempre es el más chico).
 *  - Fallback       → menor monto >= $100 de todo el texto.
 */

// ──────────────────────────────────────────────────────────────────────────
// Preprocesado de imagen
// ──────────────────────────────────────────────────────────────────────────

async function preprocess(imagePath) {
  const image = await Jimp.read(imagePath);

  if (image.bitmap.width < 1400) {
    image.scale(1400 / image.bitmap.width);
  }
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

async function ocrSpace(base64DataUri) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch no disponible (se requiere Node 18+)');
  }

  const body = new URLSearchParams();
  body.append('base64Image', base64DataUri);
  body.append('language', 'spa');
  body.append('OCREngine', '2');
  body.append('scale', 'true');
  body.append('isTable', 'true');
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
    const msg = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join(' ')
      : json.ErrorMessage;
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
// Helpers numéricos
// ──────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un string de monto a número.
 *
 * Casos que maneja:
 *   AR estándar:  1.234,56  → 1234.56
 *   US estándar:  1,234.56  → 1234.56
 *   Solo coma:    46,469    → 46469    (3 dígitos = miles)
 *   Solo coma:    46,43     → 46.43    (2 dígitos = decimal)
 *   Solo punto:   46.469    → 46469    (3 dígitos = miles)
 *   Solo punto:   46.43     → 46.43    (2 dígitos = decimal)
 *   Múlt. puntos: 1.234.567 → 1234567
 */
function parseMonto(raw) {
  let s = String(raw).trim().replace(/\s/g, '');

  const tienePunto = s.includes('.');
  const tieneComa = s.includes(',');
  const cantPuntos = (s.match(/\./g) || []).length;

  if (tienePunto && tieneComa) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // AR: 1.234,56 → punto=miles, coma=decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56 → coma=miles, punto=decimal
      s = s.replace(/,/g, '');
    }
  } else if (tieneComa && !tienePunto) {
    const parteDecimal = s.split(',')[1];
    if (parteDecimal && parteDecimal.length === 3) {
      s = s.replace(',', '');       // 46,469 → miles
    } else {
      s = s.replace(',', '.');      // 46,43  → decimal
    }
  } else if (tienePunto && !tieneComa) {
    const parteDecimal = s.split('.')[cantPuntos];
    if (cantPuntos === 1 && parteDecimal && parteDecimal.length === 3) {
      s = s.replace('.', '');       // 46.469 → miles
    } else if (cantPuntos > 1) {
      s = s.replace(/\./g, '');     // 1.234.567 → quitar todos
    }
    // 46.43 → ya está bien
  }

  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
}

// ──────────────────────────────────────────────────────────────────────────
// Extracción principal
// ──────────────────────────────────────────────────────────────────────────

/**
 * Recolecta todos los montos de líneas con palabras clave de "total"
 * y devuelve el menor (= 1° vencimiento en boletas con dos fechas,
 * o el único total en boletas simples).
 */
function extractAmountFromText(text) {
  if (!text) return null;

  const lines = text.split(/\r?\n/);

  // Log de las primeras 20 líneas para debugging
  console.log('[OCR] Texto recibido (primeras 20 líneas):');
  lines.slice(0, 20).forEach((l, i) => console.log(`  ${i + 1}: ${l}`));

  /**
   * Regex que captura montos en todos los formatos:
   *   1.234,56 / 1,234.56 / 46.469,43 / 46,469.43 / 46.43 / 46,43 / 46469
   */
  const montoRe = /\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d{1,3}(?:[.,]\d{3})+|\d+[.,]\d{2}|\d{4,})/g;

  /** Devuelve todos los montos válidos (>= $100, no años) de un string. */
  function extraerMontos(str) {
    const resultados = [];
    for (const m of str.matchAll(montoRe)) {
      const val = parseMonto(m[1].replace(/^\$/, '').trim());
      if (val && val >= 100 && val < 10_000_000 && !(val >= 2000 && val <= 2100)) {
        resultados.push(val);
      }
    }
    return resultados;
  }

  // ── Recolectar todos los montos de líneas con "total" / "a pagar" ────
  const totalAmounts = [];
  const allAmounts = [];

  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();

    // Detectar si la línea habla de un total / importe a pagar
    const esLineaTotal = (
      /total\s*a\s*pagar/.test(low) ||
      /importe\s*a\s*pagar/.test(low) ||
      /monto\s*a\s*pagar/.test(low) ||
      /\ba\s*pagar\b/.test(low) ||
      (/\btotal\b/.test(low) && !/sub\s*total/.test(low))
    );

    const montos = extraerMontos(lines[i]);

    for (const val of montos) {
      allAmounts.push(val);
      if (esLineaTotal) {
        console.log(`[OCR] Candidato total → línea ${i + 1}: $${val}  ("${lines[i].trim().slice(0, 80)}")`);
        totalAmounts.push(val);
      }
    }
  }

  // ── Extraer fechas para lógica de vencimientos ───────────────────────
  const allDates = [];
  const dateRe = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  for (const m of text.matchAll(dateRe)) {
    const d = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (y >= 2020 && y <= 2030) {
      allDates.push(new Date(y, mm, d));
    }
  }

  const uniqueDates = [];
  allDates.sort((a, b) => a - b).forEach(d => {
    if (!uniqueDates.length || uniqueDates[uniqueDates.length - 1].getTime() !== d.getTime()) {
      uniqueDates.push(d);
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filtramos fechas muy antiguas (ej. fecha de emisión) para quedarnos con los vencimientos
  const vtoDates = uniqueDates.filter(d => {
    const diffTime = today - d;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 90;
  });

  // ── Decisión: 1 monto → ese; varios → el menor o según fecha ─────────
  if (totalAmounts.length === 1) {
    console.log(`[OCR] Un único total encontrado → $${totalAmounts[0]}`);
    return totalAmounts[0];
  }

  if (totalAmounts.length > 1) {
    const minAmount = Math.min(...totalAmounts);
    const maxAmount = Math.max(...totalAmounts);

    if (vtoDates.length >= 1 && minAmount !== maxAmount) {
      const firstExpiration = vtoDates[0];
      
      if (today > firstExpiration) {
        console.log(`[OCR] Vencido (hoy > 1er vto: ${firstExpiration.toLocaleDateString()}). Tomando monto recargo: $${maxAmount}`);
        return maxAmount;
      } else {
        console.log(`[OCR] Al día (hoy <= 1er vto: ${firstExpiration.toLocaleDateString()}). Tomando monto base: $${minAmount}`);
        return minAmount;
      }
    }

    const resultado = minAmount;
    console.log(`[OCR] ${totalAmounts.length} totales encontrados [${totalAmounts.join(', ')}] → menor: $${resultado}`);
    return resultado;
  }

  // ── Fallback: menor monto significativo de todo el texto ──────────────
  const montosFiltrados = allAmounts.filter(v => v >= 100);
  if (montosFiltrados.length > 0) {
    const resultado = Math.min(...montosFiltrados);
    console.log(`[OCR] Fallback → menor monto significativo: $${resultado}`);
    return resultado;
  }

  console.warn('[OCR] No se pudo extraer ningún monto del texto.');
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────────────

async function extractTextFromImage(imagePath) {
  if (imagePath.toLowerCase().endsWith('.pdf')) {
    try {
      const dataBuffer = await fs.promises.readFile(imagePath);
      const uint8Array = new Uint8Array(dataBuffer);

      // Extraer texto digital del PDF con pdfjs-dist
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      if (fullText.trim().length > 50) {
        console.log('[OCR] PDF parseado nativamente con pdfjs-dist');
        return fullText;
      }

      // Si el PDF no tiene texto digital → OCR.space como fallback
      if (process.env.OCR_SPACE_API_KEY) {
        console.log('[OCR] PDF sin texto digital, enviando a OCR.space...');
        const base64 = dataBuffer.toString('base64');
        const text = await ocrSpace(`data:application/pdf;base64,${base64}`);
        if (text && text.trim()) return text;
      }

      console.warn('[OCR] No se pudo extraer texto del PDF.');
      return '';
    } catch (err) {
      console.error('[OCR] Error procesando PDF:', err);
      return '';
    }
  }

  // Si no es PDF, fluye normal como imagen
  const { png, jpegBase64 } = await preprocess(imagePath);

  if (process.env.OCR_SPACE_API_KEY) {
    try {
      const text = await ocrSpace(jpegBase64);
      if (text && text.trim()) return text;
      console.warn('[OCR] OCR.space devolvió vacío, uso Tesseract como respaldo.');
    } catch (e) {
      console.warn('[OCR] OCR.space falló, uso Tesseract como respaldo:', e.message);
    }
  }

  return tesseract(png);
}

/**
 * Escanea un ticket/boleta: OCR + extracción del importe del 1° vencimiento.
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
    } catch (_) { /* ignorar */ }
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