const express = require('express');
const prisma  = require('../db');
const { adminMiddleware } = require('../middleware/auth');
const { invalidateZoneCache, invalidateHubCache } = require('../services/geofence');

const router = express.Router();

// GET /api/admin/dashboard
router.get('/dashboard', adminMiddleware, async (req, res) => {
  try {
    const [total, available, inUse, offline, totalRides, activeRides] = await Promise.all([
      prisma.scooter.count(),
      prisma.scooter.count({ where: { status: 'available' } }),
      prisma.scooter.count({ where: { status: 'in_use' } }),
      prisma.scooter.count({ where: { status: 'offline' } }),
      prisma.ride.count({ where: { status: 'completed' } }),
      prisma.ride.count({ where: { status: 'active' } }),
    ]);

    const revenueAgg = await prisma.ride.aggregate({
      where: { status: 'completed' },
      _sum: { cost: true },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayAgg = await prisma.ride.aggregate({
      where: { status: 'completed', endTime: { gte: todayStart } },
      _sum: { cost: true },
    });

    const batAgg = await prisma.scooter.aggregate({ _avg: { battery: true } });
    const [userCount, hubCount] = await Promise.all([
      prisma.user.count(),
      prisma.hub.count(),
    ]);

    res.json({
      scooters: { total, available, inUse, offline },
      rides:    { total: totalRides + activeRides, active: activeRides, completed: totalRides },
      revenue:  {
        total: parseFloat((revenueAgg._sum.cost || 0).toFixed(2)),
        today: parseFloat((todayAgg._sum.cost    || 0).toFixed(2)),
      },
      fleet:    { avgBattery: parseFloat((batAgg._avg.battery || 0).toFixed(1)) },
      users:    { total: userCount },
      hubs:     { total: hubCount },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/scooters
router.get('/scooters', adminMiddleware, async (req, res) => {
  try {
    const scooters = await prisma.scooter.findMany({ include: { hub: true } });
    res.json(scooters);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/rides
router.get('/rides', adminMiddleware, async (req, res) => {
  try {
    const rides = await prisma.ride.findMany({
      orderBy: { startTime: 'desc' },
      include: {
        user:    { select: { name: true, email: true } },
        scooter: { select: { name: true } },
      },
    });
    const normalized = rides.map((r) => ({
      ...r,
      userName:    r.user?.name,
      scooterName: r.scooter?.name,
    }));
    res.json(normalized);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/hubs
router.get('/hubs', adminMiddleware, async (req, res) => {
  try {
    res.json(await prisma.hub.findMany({ include: { zone: true } }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/hubs
router.post('/hubs', adminMiddleware, async (req, res) => {
  try {
    const { name, lat, lng, zoneId, capacity } = req.body;
    if (!name || lat == null || lng == null)
      return res.status(400).json({ error: 'Nome, lat e lng são obrigatórios' });

    const hub = await prisma.hub.create({
      data: {
        name,
        lat:      parseFloat(lat),
        lng:      parseFloat(lng),
        zoneId:   zoneId || null,
        capacity: capacity || 4,
      },
    });
    invalidateHubCache();
    res.status(201).json(hub);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/hubs/:id
router.delete('/hubs/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.hub.delete({ where: { id: req.params.id } });
    invalidateHubCache();
    res.json({ success: true });
  } catch { res.status(404).json({ error: 'Hub não encontrado' }); }
});

// GET /api/admin/zones
router.get('/zones', adminMiddleware, async (req, res) => {
  try {
    const zones = await prisma.zone.findMany();
    // Converte centerLat/centerLng para formato { center: { lat, lng } }
    res.json(zones.map(z => ({
      id:     z.id,
      name:   z.name,
      color:  z.color,
      radius: z.radius,
      center: { lat: z.centerLat, lng: z.centerLng },
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/zones
router.post('/zones', adminMiddleware, async (req, res) => {
  try {
    const { name, color, radius, center } = req.body;
    if (!name || !center?.lat || !center?.lng)
      return res.status(400).json({ error: 'Nome e coordenadas são obrigatórios' });

    const zone = await prisma.zone.create({
      data: {
        name,
        color:     color || '#3B82F6',
        radius:    parseInt(radius) || 500,
        centerLat: parseFloat(center.lat),
        centerLng: parseFloat(center.lng),
      },
    });
    invalidateZoneCache();
    res.status(201).json({
      id: zone.id, name: zone.name, color: zone.color, radius: zone.radius,
      center: { lat: zone.centerLat, lng: zone.centerLng },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/zones/:id
router.delete('/zones/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.zone.delete({ where: { id: req.params.id } });
    invalidateZoneCache();
    res.json({ success: true });
  } catch { res.status(404).json({ error: 'Zona não encontrada' }); }
});

// GET /api/admin/users
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ omit: { password: true } });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
