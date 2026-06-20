import { API_URL } from './api';

/**
 * Sube una foto de ticket al backend
 * @param {string} imageUri - URI local de la imagen (file:// o file path)
 * @returns {Promise<Object>} - { filename, url, mimetype, size }
 */
export const uploadTicketPhoto = async (imageUri) => {
  try {
    const formData = new FormData();
    
    // Obtener nombre de archivo
    const filename = imageUri.split('/').pop();
    
    // Crear blob de la imagen
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Agregar a FormData
    formData.append('file', blob, filename);
    
    // Enviar al servidor
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
