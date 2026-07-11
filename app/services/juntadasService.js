import api from './api';

let localJuntadas = [];
let localListeners = [];

export const getLocalJuntadas = () => localJuntadas;

export const setLocalJuntadas = (list) => {
  localJuntadas = list;
  localListeners.forEach(fn => fn(localJuntadas));
};

export const subscribeLocalJuntadas = (fn) => {
  localListeners.push(fn);
  fn(localJuntadas);
  return () => {
    localListeners = localListeners.filter(x => x !== fn);
  };
};

const pendingCreations = new Map();
const pendingListeners = new Map();

export const registerPendingCreation = (tempId, promise) => {
  pendingCreations.set(tempId, promise);
  promise.then(
    (result) => {
      pendingCreations.delete(tempId);
      const listener = pendingListeners.get(tempId);
      if (listener) {
        listener({ success: true, result });
        pendingListeners.delete(tempId);
      }
    },
    (error) => {
      pendingCreations.delete(tempId);
      const listener = pendingListeners.get(tempId);
      if (listener) {
        listener({ success: false, error });
        pendingListeners.delete(tempId);
      }
    }
  );
};

export const subscribePendingCreation = (tempId, callback) => {
  pendingListeners.set(tempId, callback);
  return () => {
    pendingListeners.delete(tempId);
  };
};

export const listarJuntadas = async (nombre) => {
  const response = await api.get(`/juntadas?usuario=${encodeURIComponent(nombre)}`);
  const data = response?.data?.data || response?.data || response;
  const list = Array.isArray(data) ? data : [];
  
  // Fusionar con optimistas locales que sigan pendientes
  const optimisticItems = localJuntadas.filter(j => String(j.id).startsWith('temp-'));
  const filteredRemote = list.filter(remoteJ => !optimisticItems.some(opt => opt.nombre === remoteJ.nombre));
  
  setLocalJuntadas([...optimisticItems, ...filteredRemote]);
  return response;
};

export const crearJuntada = (datos) => api.post('/juntadas', datos);
export const editarJuntada       = (id, datos) => api.patch(`/juntadas/${id}`, datos);
export const obtenerJuntada      = (id)      => api.get(`/juntadas/${id}`);
export const eliminarJuntada     = (id)      => api.delete(`/juntadas/${id}`);

// Participantes
export const agregarParticipante = (juntadaId, p)   => api.post(`/juntadas/${juntadaId}/participantes`, p);
export const quitarParticipante  = (juntadaId, pid) => api.delete(`/juntadas/${juntadaId}/participantes/${pid}`);

// Gastos
/**
 * @param {string} juntadaId 
 * @param {Object} g - { nombre, pagador, monto, splitMode, splitSubgroups, beneficiarios }
 */
export const agregarGasto        = (juntadaId, g)   => api.post(`/juntadas/${juntadaId}/gastos`, g);
export const eliminarGasto       = (juntadaId, gid) => api.delete(`/juntadas/${juntadaId}/gastos/${gid}`);

// Balance
export const obtenerBalance      = (juntadaId) => api.get(`/juntadas/${juntadaId}/balance`);
export const obtenerBalanceGlobal = (nombre)   => api.get(`/juntadas/balance/global/${encodeURIComponent(nombre)}`);

// Subgrupos
export async function agregarSubgrupo(juntadaId, datos) {
  const response = await api.post(`/juntadas/${juntadaId}/subgrupos`, datos);
  return response;
}

export const editarSubgrupo = (juntadaId, sgid, datos) =>
  api.patch(`/juntadas/${juntadaId}/subgrupos/${sgid}`, datos);

export const eliminarSubgrupo = (juntadaId, subgrupoId) => 
  api.delete(`/juntadas/${juntadaId}/subgrupos/${subgrupoId}`);

// Invitaciones
export const obtenerInvitacion  = (juntadaId) => api.get(`/juntadas/${juntadaId}/invitacion`);
export const generarInvitacion  = (juntadaId) => api.post(`/juntadas/${juntadaId}/invitacion`);
export const unirseViaToken     = (token)     => api.post(`/juntadas/join/${token}`);