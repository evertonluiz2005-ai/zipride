const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ─── ZONAS (hardcoded Campo Mourão, PR) ──────────────────────────────────────
const zones = [
  {
    id: 'zone-centro',
    name: 'Centro',
    color: '#3B82F6',
    center: { lat: -24.0449, lng: -52.3831 },
    radius: 600, // metros
  },
  {
    id: 'zone-unicentro',
    name: 'Universidade (UNICENTRO)',
    color: '#10B981',
    center: { lat: -24.0549, lng: -52.3731 },
    radius: 500,
  },
  {
    id: 'zone-shopping',
    name: 'Shopping Avenida',
    color: '#F59E0B',
    center: { lat: -24.0349, lng: -52.3931 },
    radius: 400,
  },
];

// ─── HUBS (pontos fixos) ──────────────────────────────────────────────────────
const hubs = [
  {
    id: 'hub-01',
    name: 'Hub Centro - Praça da Bandeira',
    lat: -24.0449,
    lng: -52.3831,
    zoneId: 'zone-centro',
    capacity: 8,
  },
  {
    id: 'hub-02',
    name: 'Hub UNICENTRO - Entrada Principal',
    lat: -24.0549,
    lng: -52.3731,
    zoneId: 'zone-unicentro',
    capacity: 6,
  },
  {
    id: 'hub-03',
    name: 'Hub Shopping Avenida',
    lat: -24.0349,
    lng: -52.3931,
    zoneId: 'zone-shopping',
    capacity: 6,
  },
  {
    id: 'hub-04',
    name: 'Hub Terminal Rodoviário',
    lat: -24.0412,
    lng: -52.3795,
    zoneId: 'zone-centro',
    capacity: 4,
  },
];

// ─── PATINETES (seed: 5 unidades) ────────────────────────────────────────────
const scooters = [
  {
    id: 'SCT-001',
    name: 'Patinete #001',
    status: 'available', // available | in_use | offline | maintenance
    locked: true,
    battery: 87,
    lat: -24.0449,
    lng: -52.3831,
    hubId: 'hub-01',
    currentRideId: null,
    lastUpdate: new Date().toISOString(),
    model: 'Segway Ninebot E2',
    totalRides: 12,
  },
  {
    id: 'SCT-002',
    name: 'Patinete #002',
    status: 'available',
    locked: true,
    battery: 64,
    lat: -24.0551,
    lng: -52.3729,
    hubId: 'hub-02',
    currentRideId: null,
    lastUpdate: new Date().toISOString(),
    model: 'Segway Ninebot E2',
    totalRides: 8,
  },
  {
    id: 'SCT-003',
    name: 'Patinete #003',
    status: 'available',
    locked: true,
    battery: 95,
    lat: -24.0351,
    lng: -52.3929,
    hubId: 'hub-03',
    currentRideId: null,
    lastUpdate: new Date().toISOString(),
    model: 'Xiaomi Mi Pro 2',
    totalRides: 22,
  },
  {
    id: 'SCT-004',
    name: 'Patinete #004',
    status: 'offline',
    locked: true,
    battery: 8,
    lat: -24.0412,
    lng: -52.3795,
    hubId: 'hub-04',
    currentRideId: null,
    lastUpdate: new Date().toISOString(),
    model: 'Xiaomi Mi Pro 2',
    totalRides: 31,
  },
  {
    id: 'SCT-005',
    name: 'Patinete #005',
    status: 'available',
    locked: true,
    battery: 42,
    lat: -24.0455,
    lng: -52.3820,
    hubId: 'hub-01',
    currentRideId: null,
    lastUpdate: new Date().toISOString(),
    model: 'Segway Ninebot E2',
    totalRides: 5,
  },
];

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────
const users = [
  {
    id: uuidv4(),
    name: 'Admin Sistema',
    email: 'admin@patinete.com',
    phone: '44999990000',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    createdAt: new Date().toISOString(),
    totalRides: 0,
    balance: 100.0,
  },
  {
    id: uuidv4(),
    name: 'João Teste',
    email: 'joao@teste.com',
    phone: '44988887777',
    password: bcrypt.hashSync('123456', 10),
    role: 'user',
    createdAt: new Date().toISOString(),
    totalRides: 3,
    balance: 50.0,
  },
];

// ─── CORRIDAS ─────────────────────────────────────────────────────────────────
const rides = [];

// ─── STORE EXPORT ─────────────────────────────────────────────────────────────
const store = {
  zones,
  hubs,
  scooters,
  users,
  rides,

  // Helpers
  findUser: (id) => users.find((u) => u.id === id),
  findUserByEmail: (email) => users.find((u) => u.email === email),
  findScooter: (id) => scooters.find((s) => s.id === id),
  findRide: (id) => rides.find((r) => r.id === id),
  findActiveRideByUser: (userId) =>
    rides.find((r) => r.userId === userId && r.status === 'active'),
  findActiveRideByScooter: (scooterId) =>
    rides.find((r) => r.scooterId === scooterId && r.status === 'active'),

  addUser: (user) => { users.push(user); return user; },
  addRide: (ride) => { rides.push(ride); return ride; },
};

module.exports = store;
