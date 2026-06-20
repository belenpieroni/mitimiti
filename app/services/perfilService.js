import api from './api';

export async function obtenerPerfil(nombre) {
  try {
    return await api.get(`/perfiles/${encodeURIComponent(nombre)}`);
  } catch (error) {
    throw new Error(error.message || 'Error al obtener el perfil');
  }
}

export async function actualizarPerfil(nombre, alias) {
  try {
    return await api.put(`/perfiles/${encodeURIComponent(nombre)}`, { alias });
  } catch (error) {
    throw new Error(error.message || 'Error al actualizar el perfil');
  }
}

export async function eliminarPerfil(nombre) {
  try {
    return await api.delete(`/perfiles/${encodeURIComponent(nombre)}`);
  } catch (error) {
    throw new Error(error.message || 'Error al eliminar el perfil');
  }
}
