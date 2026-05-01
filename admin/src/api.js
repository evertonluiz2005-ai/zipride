const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('admin_token'); }

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  getDashboard: () => request('/admin/dashboard'),
  getScooters: () => request('/admin/scooters'),
  getRides: () => request('/admin/rides'),
  getHubs: () => request('/admin/hubs'),
  getZones: () => request('/admin/zones'),
  createZone: (data) => request('/admin/zones', { method: 'POST', body: data }),
  deleteZone: (id) => request(`/admin/zones/${id}`, { method: 'DELETE' }),
  createHub: (data) => request('/admin/hubs', { method: 'POST', body: data }),
  deleteHub: (id) => request(`/admin/hubs/${id}`, { method: 'DELETE' }),
  lockScooter: (id) => request('/scooters/lockScooter', { method: 'POST', body: { scooterId: id } }),
  unlockScooter: (id) => request('/scooters/unlockScooter', { method: 'POST', body: { scooterId: id } }),
  moveScooter: (id, lat, lng) => request(`/scooters/${id}/position`, { method: 'PATCH', body: { lat, lng } }),
};
export default api;
