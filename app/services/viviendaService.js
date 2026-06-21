import api from './api';

export const getGastosVivienda = async () => {
  return await api.get('/vivienda/gastos');
};

export const crearGastoVivienda = async (gastoData) => {
  return await api.post('/vivienda/gastos', gastoData);
};

export const getServiciosVivienda = async () => {
  return await api.get('/vivienda/servicios');
};

export const crearServicioVivienda = async (servicioData) => {
  return await api.post('/vivienda/servicios', servicioData);
};

export const actualizarGastoVivienda = async (id, gastoData) => {
  return await api.put(`/vivienda/gastos/${id}`, gastoData);
};

export const actualizarServicioVivienda = async (id, servicioData) => {
  return await api.put(`/vivienda/servicios/${id}`, servicioData);
};
