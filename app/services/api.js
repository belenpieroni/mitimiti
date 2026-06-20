import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/$/, '');
}

function getExpoHost() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }

  const scriptUrl = NativeModules?.SourceCode?.scriptURL;
  if (typeof scriptUrl === 'string') {
    const match = scriptUrl.match(/^https?:\/\/([^:/]+)(?::\d+)?\//);
    if (match?.[1]) {
      return match[1];
    }
  }

  return 'localhost';
}

function isLikelyTunnelHost(host) {
  return /(^|\.)exp\.direct$|(^|\.)expo\.dev$|(^|\.)ngrok\./.test(host);
}

function getApiBase() {
  const explicitBase = process.env.EXPO_PUBLIC_API_URL;

  if (explicitBase) {
    console.log('Usando API desde .env:', explicitBase);
    return normalizeBaseUrl(explicitBase);
  }

  console.warn('EXPO_PUBLIC_API_URL no configurada');
  return 'http://localhost:3000/api';
}

const API_BASE = getApiBase();
const REQUEST_TIMEOUT = 10000; // 10 segundos

// ── Gestión de Token ────────────────────────────────────────────────────────

let authToken = null;

/**
 * Carga el token guardado en AsyncStorage
 */
export const loadStoredToken = async () => {
  try {
    const stored = await AsyncStorage.getItem('auth_token');
    if (stored) {
      authToken = stored;
      return stored;
    }
  } catch (error) {
    console.error('Error loading token:', error);
  }
  return null;
};

/**
 * Obtiene el token actual
 */
export const getAuthToken = () => authToken;

// ── Request Handler ─────────────────────────────────────────────────────────

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('REQUEST INICIADO');
  console.log('API_BASE:', API_BASE);
  console.log('ENDPOINT:', endpoint);
  console.log('URL FINAL:', url);
  console.log('METHOD:', options.method || 'GET');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...options,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);

    clearTimeout(timeout);

    console.log('STATUS:', response.status);

    const json = await response.json();

    console.log('RESPUESTA:', JSON.stringify(json, null, 2));

    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Error ${response.status}`);
    }

    return json.data;
  } catch (error) {
    clearTimeout(timeout);

    console.log('❌ ERROR FETCH');
    console.log('NAME:', error.name);
    console.log('MESSAGE:', error.message);
    console.log(error);

    if (error.name === 'AbortError') {
      throw new Error('Solicitud agotó el tiempo de espera (10s)');
    }

    throw error;
  }
}

// ── API Methods ─────────────────────────────────────────────────────────────

const api = {
  get: (endpoint) => request(endpoint),
  
  post: (endpoint, body) => request(endpoint, { 
    method: 'POST',   
    body: JSON.stringify(body) 
  }),
  
  delete: (endpoint) => request(endpoint, { 
    method: 'DELETE' 
  }),

  // ── Autenticación ────────────────────────────────────────────────────────
  
  /**
   * Registra un nuevo usuario
   */
  register: async (name, email, password) => {
    return await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  },

  /**
   * Inicia sesión y almacena el token
   */
  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    // Guardar token y datos de usuario
    authToken = data.token;
    try {
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
    } catch (error) {
      console.error('Error saving token:', error);
    }
    
    return data.user;
  },

  /**
   * Cierra sesión y limpia el almacenamiento
   */
  logout: async () => {
    authToken = null;
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  }
};

export default api;