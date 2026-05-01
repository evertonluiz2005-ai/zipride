const express = require('express');
const prisma  = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { refreshScooter, getCache }        = require('../services/gpsSimulator');

const router = express.Router();

// GET /api/scooters
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.json(getCache());
    // Usuário comum: apenas disponíveis com bateria ok
    const available = getCache().filter((s) => s.status === 'available' && s.battery >= 10);
    res.json(available);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/scooters/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const scooter = await prisma.scooter.findUnique({ where: { id: req.params.id } });
    if (!scooter) return res.status(404).json({ error: 'Patinete não encontrado' });
    res.json(scooter);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/scooters/lockScooter
router.post('/lockScooter', adminMiddleware, async (req, res) => {
  try {
    const { scooterId } = req.body;
    const existing = await prisma.scooter.findUnique({ where: { id: scooterId } });
    if (!existing) return res.status(404).json({ error: 'Patinete não encontrado' });

    const scooter = await prisma.scooter.update({
      where: { id: scooterId },
      data: {
        locked: true,
        status: existing.status === 'available' ? 'offline' : existing.status,
      },
    });
    await refreshScooter(scooter.id);
    res.json({ success: true, message: `Patinete ${scooterId} bloqueado`, scooter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/scooters/unlockScooter
router.post('/unlockScooter', adminMiddleware, async (req, res) => {
  try {
    const { scooterId } = req.body;
    const existing = await prisma.scooter.findUnique({ where: { id: scooterId } });
    if (!existing) return res.status(404).json({ error: 'Patinete não encontrado' });
    if (existing.battery < 10)
      return res.status(400).json({ error: 'Bateria muito baixa para desbloquear' });

    const scooter = await prisma.scooter.update({
      where: { id: scooterId },
      data: { locked: false, status: 'available' },
    });
    await refreshScooter(scooter.id);
    res.json({ success: true, message: `Patinete ${scooterId} desbloqueado`, scooter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/scooters/:id/position
router.patch('/:id/position', adminMiddleware, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const scooter = await prisma.scooter.update({
      where: { id: req.params.id },
      data: { lat: parseFloat(lat), lng: parseFloat(lng), lastUpdate: new Date() },
    });
    await refreshScooter(scooter.id);
    res.json({ success: true, scooter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/scooters/:id/battery
router.patch('/:id/battery', adminMiddleware, async (req, res) => {
  try {
    const newBat = Math.max(0, Math.min(100, parseFloat(req.body.battery)));
    const existing = await prisma.scooter.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Patinete não encontrado' });

    const scooter = await prisma.scooter.update({
      where: { id: req.params.id },
      data: {
        battery: newBat,
        status: newBat >= 10 && existing.status === 'offline' && !existing.locked
          ? 'available' : existing.status,
      },
    });
    await refreshScooter(scooter.id);
    res.json({ success: true, scooter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
