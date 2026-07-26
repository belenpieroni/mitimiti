import api from './api';

export const getGastosVivienda = async () => await api.get('/vivienda/gastos');
export const guardarGastoVivienda = async (data, options = {}) => await api.post('/vivienda/gastos', data, options);
export const actualizarGastoVivienda = async (id, data, options = {}) => await api.put(`/vivienda/gastos/${id}`, data, options);

export const getServiciosVivienda = async () => await api.get('/vivienda/servicios');
export const crearServicioVivienda = async (data, options = {}) => await api.post('/vivienda/servicios', data, options);
export const actualizarServicioVivienda = async (id, data, options = {}) => await api.put(`/vivienda/servicios/${id}`, data, options);
export const eliminarServicioVivienda = async (id) => await api.delete(`/vivienda/servicios/${id}`);
export const liquidarServicioVivienda = async (id, data) => await api.patch(`/vivienda/servicios/${id}/liquidar`, data);

export const getAcuerdosReparto = async () => await api.get('/vivienda/acuerdos');
export const guardarAcuerdoReparto = async (data) => await api.post('/vivienda/acuerdos', data);
export const actualizarAcuerdoReparto = async (id, data) => await api.put(`/vivienda/acuerdos/${id}`, data);
export const eliminarAcuerdoReparto = async (id) => await api.delete(`/vivienda/acuerdos/${id}`);

export const getMiVivienda = async () => await api.get('/vivienda/actual');
export const crearMiVivienda = async (payload = {}) => await api.post('/vivienda/crear', payload);
export const obtenerInvitacionVivienda = async () => await api.get('/vivienda/invitacion');
export const unirseViviendaViaToken = async (token) => await api.post(`/vivienda/join/${token}`);

export const marcarPagadoVivienda = async (tipo, id) => await api.patch(`/vivienda/${tipo}/${id}/pagar`);
export const revertirPagoVivienda = async (tipo, id) => await api.patch(`/vivienda/${tipo}/${id}/revertir`);
export const eliminarGastoVivienda = async (id) => await api.delete(`/vivienda/gastos/${id}`);
