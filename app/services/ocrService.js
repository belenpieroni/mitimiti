import { API_URL, getAuthToken } from './api';

/**
 * OCR de tickets — versión que corre contra el BACKEND.
 *
 * Antes esto usaba tesseract.js directamente en la app, pero Tesseract.js
 * necesita APIs de navegador (Worker, Blob, canvas) que React Native / Expo
 * NO tiene -> de ahí el error "Property 'Worker' doesn't exist".
 *
 * Ahora la app solo manda la foto al backend (POST /api/uploads/scan),
 * el server corre el OCR y nos devuelve el importe ya extraído.
 */

function buildFilePart(imageUri) {
  const filename = imageUri.split('/').pop() || `ticket-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const ext = (match ? match[1] : 'jpg').toLowerCase();
  const type = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri: imageUri, name: filename, type };
}

/**
 * Sube la foto del ticket y corre OCR en el backend.
 * @param {string} imageUri
 * @returns {Promise<{ amount: number|null, text: string, ticketUrl: string }>}
 */
export const scanTicket = async (imageUri) => {
  try {
    const formData = new FormData();
    formData.append('file', buildFilePart(imageUri));

    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[OCR] Enviando a:', `${API_URL}/api/uploads/scan`);
    console.log('[OCR] Token:', token ? 'presente' : 'AUSENTE');

    const response = await fetch(`${API_URL}/api/uploads/scan`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Error del servidor: ${response.status}`);
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || 'Error desconocido en el OCR');
    }

    return {
      amount: result.data.amount,
      text: result.data.text || '',
      ticketUrl: result.data.url,
    };
  } catch (error) {
    console.error('Error escaneando ticket:', error);
    throw error;
  }
};

export const extractAmountFromTicket = async (imageUri) => {
  const { amount } = await scanTicket(imageUri);
  return amount;
};
