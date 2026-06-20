import { createWorker } from 'tesseract.js';

let worker = null;

/**
 * Inicializa el worker de Tesseract (una sola vez)
 */
const initWorker = async () => {
  if (worker) return worker;
  
  try {
    worker = await createWorker('spa'); // Español para mejor detección
    return worker;
  } catch (error) {
    console.error('Error inicializando OCR:', error);
    throw error;
  }
};

/**
 * Extrae texto de una imagen usando OCR
 */
export const extractTextFromImage = async (imageUri) => {
  try {
    const ocr = await initWorker();
    
    const result = await ocr.recognize(imageUri);
    return result.data.text;
  } catch (error) {
    console.error('Error en OCR:', error);
    throw error;
  }
};

/**
 * Extrae el importe total de un ticket
 * Busca números con decimales y retorna el más probable (el mayor)
 */
export const extractAmountFromTicket = async (imageUri) => {
  try {
    const text = await extractTextFromImage(imageUri);
    
    // Busca números con formato: 123.45, 123,45, 123456, etc.
    // Prioriza números con decimales (más probable que sea el total)
    const patterns = [
      /\$?\s*(\d+[.,]\d{2})/g,           // 123.45 o 123,45 o $123.45
      /total[:\s]*\$?\s*(\d+[.,]\d{2})/gi, // "Total: 123.45"
      /total[:\s]*(\d+)/gi,              // "Total: 12345"
      /(\d+[.,]\d{2})/g,                 // Cualquier número con 2 decimales
    ];

    let amounts = [];
    
    // Ejecuta cada patrón
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        let value = match[1].replace(',', '.'); // Normaliza a punto
        amounts.push(parseFloat(value));
      }
    }

    // Si encontró números, retorna el mayor (probablemente el total)
    if (amounts.length > 0) {
      const maxAmount = Math.max(...amounts);
      // Valida que sea un importe razonable (entre 0.01 y 1000000)
      if (maxAmount > 0 && maxAmount < 1000000) {
        return maxAmount;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extrayendo importe:', error);
    throw error;
  }
};

/**
 * Libera recursos del worker cuando termina la app
 */
export const terminateOCRWorker = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
};
