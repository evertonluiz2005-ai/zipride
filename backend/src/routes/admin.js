const express = require('express');
const prisma  = require('../db');
const { adminMiddleware } = require('../middleware/auth');
const { invalidateZoneCache, invalidateHubCache } = require('../services/geofence');
const fcm     = require('../services/fcm');

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

// POST /api/admin/scooters
router.post('/scooters', adminMiddleware, async (req, res) => {
  try {
    const { id, name, model, lat, lng, hubId, deviceId, simNumber } = req.body;
    if (!id || !name || lat == null || lng == null)
      return res.status(400).json({ error: 'ID, nome, lat e lng são obrigatórios' });

    const scooter = await prisma.scooter.create({
      data: {
        id,
        name,
        model:     model || 'Segway Ninebot E2',
        lat:       parseFloat(lat),
        lng:       parseFloat(lng),
        hubId:     hubId || null,
        deviceId:  deviceId || null,
        simNumber: simNumber || null,
        status:    'offline',
        locked:    true,
        battery:   100,
      },
    });

    const { refreshScooter } = require('../services/gpsSimulator');
    await refreshScooter(scooter.id);
    res.status(201).json(scooter);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'ID já existe' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/scooters/:id
router.delete('/scooters/:id', adminMiddleware, async (req, res) => {
  try {
    const active = await prisma.ride.findFirst({
      where: { scooterId: req.params.id, status: 'active' },
    });
    if (active) return res.status(400).json({ error: 'Patinete com corrida ativa' });
    await prisma.scooter.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch { res.status(404).json({ error: 'Patinete não encontrado' }); }
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
    res.json(zones.map(z => ({
      id:          z.id,
      name:        z.name,
      color:       z.color,
      coordinates: z.coordinates,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/zones
router.post('/zones', adminMiddleware, async (req, res) => {
  try {
    const { name, color, coordinates } = req.body;
    if (!name || !Array.isArray(coordinates) || coordinates.length < 3)
      return res.status(400).json({ error: 'Nome e ao menos 3 pontos são obrigatórios' });

    const zone = await prisma.zone.create({
      data: { name, color: color || '#3B82F6', coordinates },
    });
    invalidateZoneCache();
    res.status(201).json({
      id: zone.id, name: zone.name, color: zone.color, coordinates: zone.coordinates,
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

// ─── Recargas Pix ─────────────────────────────────────────────────────────────

// GET /api/admin/pix-recharges — lista todas (mais recentes primeiro)
router.get('/pix-recharges', adminMiddleware, async (req, res) => {
  try {
    const recharges = await prisma.pixRecharge.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, email: true, cpf: true } },
      },
    });
    res.json(recharges);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/pix-recharges/:id/approve — aprova e credita saldo
router.post('/pix-recharges/:id/approve', adminMiddleware, async (req, res) => {
  try {
    const recharge = await prisma.pixRecharge.findUnique({ where: { id: req.params.id } });
    if (!recharge)                        return res.status(404).json({ error: 'Recarga não encontrada' });
    if (recharge.status !== 'pending')    return res.status(400).json({ error: 'Recarga não está pendente' });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: recharge.userId },
        data:  { balance: { increment: recharge.amount } },
      }),
      prisma.pixRecharge.update({
        where: { id: req.params.id },
        data:  { status: 'paid' },
      }),
    ]);
    console.log(`✅ Pix aprovado — R$ ${recharge.amount.toFixed(2)} → usuário ${recharge.userId.slice(0, 8)}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/pix-recharges/:id/reject — rejeita
router.post('/pix-recharges/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const recharge = await prisma.pixRecharge.findUnique({ where: { id: req.params.id } });
    if (!recharge)                     return res.status(404).json({ error: 'Recarga não encontrada' });
    if (recharge.status !== 'pending') return res.status(400).json({ error: 'Recarga não está pendente' });

    await prisma.pixRecharge.update({
      where: { id: req.params.id },
      data:  { status: 'rejected', rejectedReason: req.body.reason || null },
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Documentos de identidade ─────────────────────────────────────────────────

// GET /api/admin/ride-photo/:filename — foto de devolução (autenticação admin)
router.get('/ride-photo/:filename', adminMiddleware, (req, res) => {
  const { UPLOADS_DIR } = require('../config');
  const filename = path.basename(req.params.filename);
  const filepath = require('path').join(UPLOADS_DIR, 'rides', filename);
  if (!require('fs').existsSync(filepath))
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.sendFile(filepath);
});

// GET /api/admin/documents/image/:filename — serve imagem com autenticação admin
router.get('/documents/image/:filename', adminMiddleware, (req, res) => {
  const { UPLOADS_DIR } = require('../config');
  const filename = path.basename(req.params.filename); // impede path traversal
  const filepath = require('path').join(UPLOADS_DIR, 'documents', filename);
  if (!require('fs').existsSync(filepath))
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.sendFile(filepath);
});

// GET /api/admin/documents — usuários que enviaram documento
router.get('/documents', adminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where:   { documentImageUrl: { not: null } },
      select:  {
        id: true, name: true, email: true, cpf: true,
        documentStatus: true, documentImageUrl: true,
        documentRejectedReason: true, updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/documents/:userId/approve
router.post('/documents/:userId/approve', adminMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data:  { documentStatus: 'approved', documentRejectedReason: null },
    });
    fcm.send(user.fcmToken, {
      title: '✅ Identidade verificada!',
      body:  'Seu documento foi aprovado. Boa viagem com o ZipRide!',
      data:  { type: 'document_approved' },
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/documents/:userId/reject
router.post('/documents/:userId/reject', adminMiddleware, async (req, res) => {
  try {
    const reason = req.body.reason || null;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data:  { documentStatus: 'rejected', documentRejectedReason: reason },
    });
    fcm.send(user.fcmToken, {
      title: 'Documento não aprovado',
      body:  reason
        ? `Seu documento foi rejeitado: ${reason}. Envie um novo.`
        : 'Seu documento foi rejeitado. Por favor, envie um novo.',
      data:  { type: 'document_rejected' },
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
