const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('scooter_token');
}

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
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, phone, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, phone, password } }),
  me: () => request('/auth/me'),

  // Map
  getMap: () => request('/map'),

  // Scooters
  getScooters: () => request('/scooters'),
  getScooter: (id) => request(`/scooters/${id}`),

  // Rides
  startRide: (scooterId) =>
    request('/rides/start', { method: 'POST', body: { scooterId } }),
  endRide: (rideId) =>
    request(`/rides/${rideId}/end`, { method: 'POST' }),
  getActiveRide: () => request('/rides/active'),
  getMyRides: () => request('/rides/my'),
  getPricing: () => request('/rides/pricing'),

  // Admin
  getDashboard: () => request('/admin/dashboard'),
  getAdminScooters: () => request('/admin/scooters'),
  getAdminRides: () => request('/admin/rides'),
  getHubs: () => request('/admin/hubs'),
  getZones: () => request('/admin/zones'),
  createHub: (data) => request('/admin/hubs', { method: 'POST', body: data }),
  deleteHub: (id) => request(`/admin/hubs/${id}`, { method: 'DELETE' }),
  lockScooter: (scooterId) =>
    request('/scooters/lockScooter', { method: 'POST', body: { scooterId } }),
  unlockScooter: (scooterId) =>
    request('/scooters/unlockScooter', { method: 'POST', body: { scooterId } }),
  moveScooter: (id, lat, lng) =>
    request(`/scooters/${id}/position`, { method: 'PATCH', body: { lat, lng } }),
};

export default api;
