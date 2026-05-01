const express  = require('express');
const prisma   = require('../db');
const { authMiddleware }         = require('../middleware/auth');
const { isInAllowedZone, isNearHub } = require('../services/geofence');
const { refreshScooter }         = require('../services/gpsSimulator');

const router = express.Router();

const UNLOCK_FEE    = 3.0;
const PRICE_PER_MIN = 0.5;

function calcCost(startTime, endTime) {
  const mins = (new Date(endTime) - new Date(startTime)) / 60000;
  return parseFloat((UNLOCK_FEE + mins * PRICE_PER_MIN).toFixed(2));
}

// POST /api/rides/start
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { scooterId } = req.body;
    const userId = req.user.id;

    // Corrida já ativa?
    const existing = await prisma.ride.findFirst({
      where: { userId, status: 'active' },
    });
    if (existing) return res.status(400).json({ error: 'Você já tem uma corrida ativa' });

    const scooter = await prisma.scooter.findUnique({ where: { id: scooterId } });
    if (!scooter) return res.status(404).json({ error: 'Patinete não encontrado' });
    if (scooter.status !== 'available')
      return res.status(400).json({ error: `Patinete indisponível (status: ${scooter.status})` });
    if (scooter.battery < 10)
      return res.status(400).json({ error: 'Bateria insuficiente (< 10%)' });
    if (!(await isInAllowedZone(scooter.lat, scooter.lng)))
      return res.status(400).json({ error: 'Patinete fora da zona permitida' });

    // Criar corrida
    const ride = await prisma.ride.create({
      data: {
        userId,
        scooterId,
        startLat: scooter.lat,
        startLng: scooter.lng,
        status: 'active',
        unlockFee: UNLOCK_FEE,
        pricePerMin: PRICE_PER_MIN,
      },
    });

    // Atualizar patinete
    const updatedScooter = await prisma.scooter.update({
      where: { id: scooterId },
      data: { status: 'in_use', locked: false, currentRideId: ride.id },
    });
    await refreshScooter(scooterId);

    res.status(201).json({ ride, scooter: updatedScooter });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// POST /api/rides/:id/end
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada' });
    if (ride.userId !== req.user.id) return res.status(403).json({ error: 'Não autorizado' });
    if (ride.status !== 'active') return res.status(400).json({ error: 'Corrida não está ativa' });

    const scooter = await prisma.scooter.findUnique({ where: { id: ride.scooterId } });

    const nearHub = await isNearHub(scooter.lat, scooter.lng);
    if (!nearHub && !(await isInAllowedZone(scooter.lat, scooter.lng)))
      return res.status(400).json({ error: 'Encerre a corrida dentro de um hub ou zona permitida' });

    const endTime = new Date();
    const cost    = calcCost(ride.startTime, endTime);

    // Finalizar corrida
    const updatedRide = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        endTime,
        endLat:    scooter.lat,
        endLng:    scooter.lng,
        cost,
        status:    'completed',
        nearestHub: nearHub?.name || null,
      },
    });

    // Liberar patinete
    const updatedScooter = await prisma.scooter.update({
      where: { id: scooter.id },
      data: {
        status:       'available',
        locked:       true,
        currentRideId: null,
        hubId:        nearHub?.id || scooter.hubId,
        totalRides:   { increment: 1 },
      },
    });

    // Incrementar totalRides do usuário
    await prisma.user.update({
      where: { id: req.user.id },
      data: { totalRides: { increment: 1 } },
    });

    await refreshScooter(scooter.id);

    res.json({ ride: updatedRide, scooter: updatedScooter });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/rides/my
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const rides = await prisma.ride.findMany({
      where: { userId: req.user.id },
      orderBy: { startTime: 'desc' },
      include: { scooter: { select: { name: true } } },
    });
    // Normaliza para o formato esperado pelo frontend
    const normalized = rides.map((r) => ({
      ...r,
      scooterName: r.scooter?.name,
      userName: req.user.name,
    }));
    res.json(normalized);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rides/active
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const ride = await prisma.ride.findFirst({
      where: { userId: req.user.id, status: 'active' },
    });
    if (!ride) return res.json(null);
    const scooter = await prisma.scooter.findUnique({ where: { id: ride.scooterId } });
    res.json({ ride, scooter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rides/pricing
router.get('/pricing', (_req, res) => {
  res.json({ unlockFee: UNLOCK_FEE, pricePerMin: PRICE_PER_MIN });
});

module.exports = router;
