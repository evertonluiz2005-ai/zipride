// src/services/gpsSimulator.js
// Cache em memória para GPS — persiste no DB a cada 30s para não sobrecarregar

const prisma = require('../db');

let io = null;
// Cache local dos patinetes (lat/lng/battery/status)
let scooterCache = [];
let cacheLoaded  = false;

function setIO(socketIO) { io = socketIO; }

async function loadCache() {
  scooterCache = await prisma.scooter.findMany();
  cacheLoaded = true;
}

// Normaliza formato do DB para o formato que o frontend espera
function normalize(s) {
  return {
    id: s.id,
    name: s.name,
    model: s.model,
    status: s.status,
    locked: s.locked,
    battery: s.battery,
    lat: s.lat,
    lng: s.lng,
    hubId: s.hubId,
    currentRideId: s.currentRideId,
    totalRides: s.totalRides,
    lastUpdate: s.lastUpdate instanceof Date ? s.lastUpdate.toISOString() : s.lastUpdate,
  };
}

// Atualiza posição/bateria no cache em memória (rápido, sem DB)
function simulateGPS() {
  if (!cacheLoaded) return;

  let hasInUse = false;

  scooterCache.forEach((s) => {
    if (s.status !== 'maintenance') {
      // Drenar bateria enquanto em uso
      if (s.status === 'in_use') {
        s.battery = Math.max(0, s.battery - 0.05);
        hasInUse = true;
      }
      // Patinete fica offline se bateria < 5%
      if (s.battery < 5 && s.status !== 'offline') {
        s.status = 'offline';
        s.locked = true;
      }
    }
    // Mover patinetes em uso (deriva aleatória ~11m)
    if (s.status === 'in_use') {
      const drift = 0.0001;
      s.lat += (Math.random() - 0.5) * drift;
      s.lng += (Math.random() - 0.5) * drift;
      s.lastUpdate = new Date();
    }
  });

  if (io) io.emit('scooters_update', scooterCache.map(normalize));
}

// Persiste cache no banco (a cada 30s)
async function flushToDB() {
  if (!cacheLoaded) return;
  try {
    await Promise.all(
      scooterCache.map((s) =>
        prisma.scooter.update({
          where: { id: s.id },
          data: {
            lat:       s.lat,
            lng:       s.lng,
            battery:   s.battery,
            status:    s.status,
            locked:    s.locked,
            lastUpdate: s.lastUpdate instanceof Date ? s.lastUpdate : new Date(s.lastUpdate),
          },
        })
      )
    );
  } catch (err) {
    console.error('GPS flush error:', err.message);
  }
}

// Recarregar cache do DB (para pegar alterações feitas pelas rotas)
async function refreshCache() {
  scooterCache = await prisma.scooter.findMany();
}

// Recarrega um único patinete no cache (depois de lock/unlock/start/end ride)
async function refreshScooter(id) {
  const s = await prisma.scooter.findUnique({ where: { id } });
  if (s) {
    const idx = scooterCache.findIndex((c) => c.id === id);
    if (idx !== -1) scooterCache[idx] = s;
    else scooterCache.push(s);
    if (io) io.emit('scooters_update', scooterCache.map(normalize));
  }
}

// Recarga de bateria para patinetes offline
async function simulateCharging() {
  if (!cacheLoaded) return;
  scooterCache.forEach((s) => {
    if (s.status === 'offline' && s.battery < 95) {
      s.battery = Math.min(100, s.battery + 2);
      if (s.battery >= 20) {
        s.status = 'available';
        s.locked = true;
      }
    }
  });
  if (io) io.emit('scooters_update', scooterCache.map(normalize));
}

async function startSimulation() {
  await loadCache();
  setInterval(simulateGPS,    4_000);   // GPS a cada 4s (só memória)
  setInterval(flushToDB,     30_000);   // Persiste no DB a cada 30s
  setInterval(refreshCache,  60_000);   // Recarrega do DB a cada 60s (pega updates externos)
  setInterval(simulateCharging, 30_000);
  console.log('🛰️  Simulação de GPS iniciada (cache em memória + flush DB a cada 30s)');
}

// Exporta getCache para as rotas usarem ao enviar scooters via socket
function getCache() { return scooterCache.map(normalize); }

module.exports = { setIO, startSimulation, refreshScooter, getCache };
