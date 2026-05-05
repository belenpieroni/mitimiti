import api from './api';

// Juntadas
export const listarJuntadas      = ()        => api.get('/juntadas');
export const crearJuntada        = (datos)   => api.post('/juntadas', datos);
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