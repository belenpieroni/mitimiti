// Cliente HTTP centralizado.
// UN SOLO LUGAR para cambiar la IP si te movés de red.
const API_BASE = 'http://192.168.0.241:3000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const response = await fetch(url, config);
  const json = await response.json();

  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Error ${response.status}`);
  }

  return json.data;
}

const api = {
  get:    (endpoint)       => request(endpoint),
  post:   (endpoint, body) => request(endpoint, { method: 'POST',   body: JSON.stringify(body) }),
  delete: (endpoint)       => request(endpoint, { method: 'DELETE' }),
};

export default api;