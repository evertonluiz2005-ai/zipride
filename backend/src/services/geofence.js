// src/services/geofence.js
const prisma = require('../db');

let zonesCache = [];
let lastZoneCache = 0;
let hubsCache = [];
let lastHubCache = 0;
const CACHE_TTL = 60_000;

async function getZones() {
  if (Date.now() - lastZoneCache > CACHE_TTL || zonesCache.length === 0) {
    zonesCache = await prisma.zone.findMany();
    lastZoneCache = Date.now();
  }
  return zonesCache;
}

async function getHubs() {
  if (Date.now() - lastHubCache > CACHE_TTL || hubsCache.length === 0) {
    hubsCache = await prisma.hub.findMany();
    lastHubCache = Date.now();
  }
  return hubsCache;
}

function invalidateZoneCache() { lastZoneCache = 0; }
function invalidateHubCache()  { lastHubCache  = 0; }

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function isInAllowedZone(lat, lng) {
  const zones = await getZones();
  return zones.some((z) => distanceMeters(lat, lng, z.centerLat, z.centerLng) <= z.radius);
}

async function isNearHub(lat, lng, maxMeters = 150) {
  const hubs = await getHubs();
  return hubs.find((h) => distanceMeters(lat, lng, h.lat, h.lng) <= maxMeters) || null;
}

module.exports = { distanceMeters, isInAllowedZone, isNearHub, invalidateZoneCache, invalidateHubCache };
