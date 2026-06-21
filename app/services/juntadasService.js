import api from './api';

// Juntadas
export const listarJuntadas      = ()        => api.get('/juntadas');
export const crearJuntada        = (datos)   => api.post('/juntadas', datos);
export const editarJuntada       = (id, datos) => api.patch(`/juntadas/${id}`, datos);
export const obtenerJuntada      = (id)      => api.get(`/juntadas/${id}`);
export const eliminarJuntada     = (id)      => api.delete(`/juntadas/${id}`);

// Participantes
export const agregarParticipante = (juntadaId, p)   => api.post(`/juntadas/${juntadaId}/participantes`, p);
export const quitarParticipante  = (juntadaId, pid) => api.delete(`/juntadas/${juntadaId}/participantes/${pid}`);

// Gastos
export const agregarGasto        = (juntadaId, g)   => api.post(`/juntadas/${juntadaId}/gastos`, g);
export const eliminarGasto       = (juntadaId, gid) => api.delete(`/juntadas/${juntadaId}/gastos/${gid}`);

// Balance
export const obtenerBalance      = (juntadaId) => api.get(`/juntadas/${juntadaId}/balance`);
export const obtenerBalanceGlobal = (nombre)   => api.get(`/juntadas/balance/global/${encodeURIComponent(nombre)}`);

// Subgrupos
export async function agregarSubgrupo(juntadaId, datos) {
  // datos espera un objeto: { nombre: string, integrantes: string[] }
  const response = await api.post(`/juntadas/${juntadaId}/subgrupos`, datos);
  return response;
}

export const editarSubgrupo = (juntadaId, sgid, datos) =>
  api.patch(`/juntadas/${juntadaId}/subgrupos/${sgid}`, datos);

export const eliminarSubgrupo = (juntadaId, subgrupoId) => 
  api.delete(`/juntadas/${juntadaId}/subgrupos/${subgrupoId}`);