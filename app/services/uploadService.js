import { API_URL } from './api';

/**
 * Sube una foto de ticket al backend (sin OCR).
 *
 * IMPORTANTE: en React Native NO se usa fetch(uri).blob() para adjuntar
 * archivos (es frágil y suele fallar en nativo). Se usa el objeto
 * { uri, name, type } directamente en el FormData.
 *
 * @param {string} imageUri - URI local de la imagen (file://...)
 * @returns {Promise<Object>} - { filename, url, mimetype, size }
 */
export const uploadTicketPhoto = async (imageUri) => {
  try {
    const filename = imageUri.split('/').pop() || `ticket-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = (match ? match[1] : 'jpg').toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', { uri: imageUri, name: filename, type });

    const uploadResponse = await fetch(`${API_URL}/api/uploads`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Error upload: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();
    if (!result.ok) {
      throw new Error(result.error || 'Error desconocido');
    }

    return result.data;
  } catch (error) {
    console.error('Error subiendo foto:', error);
    throw error;
  }
};
