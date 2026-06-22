import api from './api';

export async function obtenerPerfil(nombre) {
  try {
    // Si tu axios/api.js ya devuelve "res.data", esto te trae directamente el objeto del perfil
    const response = await api.get(`/perfiles/${encodeURIComponent(nombre)}`);
    return response?.data || response; 
  } catch (error) {
    throw new Error(error.message || 'Error al obtener el perfil');
  }
}

export async function actualizarPerfil(nombre, alias) {
  try {
    const response = await api.put(`/perfiles/${encodeURIComponent(nombre)}`, { alias });
    return response?.data || response;
  } catch (error) {
    throw new Error(error.message || 'Error al actualizar el perfil');
  }
}

export async function eliminarPerfil(nombre) {
  try {
    const response = await api.delete(`/perfiles/${encodeURIComponent(nombre)}`);
    return response?.data || response;
  } catch (error) {
    throw new Error(error.message || 'Error al eliminar el perfil');
  }
}