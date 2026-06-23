import api from './api';

// Si tu api.js ya tiene un interceptor que hace: response => response.data
// Entonces NO debes poner { data } = ...

export const getGastosVivienda = async () => await api.get('/vivienda/gastos');
export const guardarGastoVivienda = async (data) => await api.post('/vivienda/gastos', data);
export const actualizarGastoVivienda = async (id, data) => await api.put(`/vivienda/gastos/${id}`, data);

export const getServiciosVivienda = async () => await api.get('/vivienda/servicios');
export const crearServicioVivienda = async (data) => await api.post('/vivienda/servicios', data);
export const eliminarServicioVivienda = async (id) => await api.delete(`/vivienda/servicios/${id}`);

export const getAcuerdosReparto = async () => await api.get('/vivienda/acuerdos');
export const guardarAcuerdoReparto = async (data) => await api.post('/vivienda/acuerdos', data);
export const eliminarAcuerdoReparto = async (id) => await api.delete(`/vivienda/acuerdos/${id}`);

