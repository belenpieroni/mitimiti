import { NativeModules, Platform } from 'react-native';

// Módulo de token de autenticación (actualizado desde AppNavigator al iniciar sesión)
let _authToken = null;
export function setAuthToken(token) { _authToken = token; }
export function getAuthToken() { return _authToken; }

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
    return normalizeBaseUrl(explicitBase);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return normalizeBaseUrl(`${window.location.origin}/api`);
  }

  const host = getExpoHost();

  if (host && !isLikelyTunnelHost(host)) {
    const apiHost = Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')
      ? '10.0.2.2'
      : host;

    return `http://${apiHost}:3000/api`;
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api'
    : 'http://localhost:3000/api';
}

const API_BASE = getApiBase();

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };
  if (_authToken) {
    defaultHeaders['Authorization'] = `Bearer ${_authToken}`;
  }
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    throw new Error(`Network request failed (${url})`);
  }

  const json = await response.json();

  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Error ${response.status}`);
  }

  return json.data;
}

const api = {
  get:    (endpoint, options = {})       => request(endpoint, options),
  post:   (endpoint, body, options = {}) => request(endpoint, { method: 'POST',   body: JSON.stringify(body), ...options }),
  put:    (endpoint, body, options = {}) => request(endpoint, { method: 'PUT',    body: JSON.stringify(body), ...options }),
  patch:  (endpoint, body, options = {}) => request(endpoint, { method: 'PATCH',  body: JSON.stringify(body), ...options }),
  delete: (endpoint, options = {})       => request(endpoint, { method: 'DELETE', ...options }),
};

export const API_URL = API_BASE.replace('/api', '');
export default api;