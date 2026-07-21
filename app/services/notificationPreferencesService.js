import api from './api';

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const obtenerPreferenciasNotificaciones = (token) =>
  api.get('/auth/notification-preferences', authHeaders(token));

export const actualizarPreferenciasNotificaciones = (token, preferences) =>
  api.put('/auth/notification-preferences', preferences, authHeaders(token));
