const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const prisma   = require('../db');
const { authMiddleware }             = require('../middleware/auth');
const { isInAllowedZone, isNearHub } = require('../services/geofence');
const { refreshScooter }             = require('../services/gpsSimulator');
const { chargeRide }                 = require('../services/stripe');
const fcm                            = require('../services/fcm');
const { UPLOADS_DIR }                = require('../config');

// ─── Multer — foto de devolução ───────────────────────────────────────────────
const RIDE_PHOTOS_DIR = path.join(UPLOADS_DIR, 'rides');
fs.mkdirSync(RIDE_PHOTOS_DIR, { recursive: true });

const ridePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RIDE_PHOTOS_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const uploadRidePhoto = multer({
  storage: ridePhotoStorage,
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
});

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

    const existing = await prisma.ride.findFirst({ where: { userId, status: 'active' } });
    if (existing) return res.status(400).json({ error: 'Você já tem uma corrida ativa' });

    // Verificar forma de pagamento
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const hasCard    = !!user.stripePaymentMethodId;
    const hasBalance = user.balance >= UNLOCK_FEE;
    if (!hasCard && !hasBalance)
      return res.status(402).json({
        error: 'Adicione um cartão ou recarregue seu saldo Pix para iniciar uma corrida',
        code: 'NO_PAYMENT',
      });

    const scooter = await prisma.scooter.findUnique({ where: { id: scooterId } });
    if (!scooter)                       return res.status(404).json({ error: 'Patinete não encontrado' });
    if (scooter.status !== 'available') return res.status(400).json({ error: `Patinete indisponível (${scooter.status})` });
    if (scooter.battery < 10)           return res.status(400).json({ error: 'Bateria insuficiente (< 10%)' });
    if (!(await isInAllowedZone(scooter.lat, scooter.lng)))
      return res.status(400).json({ error: 'Patinete fora da zona permitida' });

    const ride = await prisma.ride.create({
      data: { userId, scooterId, startLat: scooter.lat, startLng: scooter.lng,
              status: 'active', unlockFee: UNLOCK_FEE, pricePerMin: PRICE_PER_MIN },
    });

    const updatedScooter = await prisma.scooter.update({
      where: { id: scooterId },
      data:  { status: 'in_use', locked: false, currentRideId: ride.id },
    });
    await refreshScooter(scooterId);

    // Push notification — fire and forget (reutiliza `user` já carregado)
    fcm.send(user?.fcmToken, {
      title: '🛴 Corrida iniciada!',
      body:  `${scooter.name} desbloqueado. Boa viagem!`,
      data:  { rideId: ride.id, type: 'ride_start' },
    });

    res.status(201).json({ ride, scooter: updatedScooter });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// POST /api/rides/:id/end
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride)                        return res.status(404).json({ error: 'Corrida não encontrada' });
    if (ride.userId !== req.user.id)  return res.status(403).json({ error: 'Não autorizado' });
    if (ride.status !== 'active')     return res.status(400).json({ error: 'Corrida não está ativa' });

    const scooter = await prisma.scooter.findUnique({ where: { id: ride.scooterId } });

    const nearHub = await isNearHub(scooter.lat, scooter.lng);
    if (!nearHub && !(await isInAllowedZone(scooter.lat, scooter.lng)))
      return res.status(400).json({ error: 'Encerre a corrida dentro de um hub ou zona permitida' });

    const endTime = new Date();
    const cost    = calcCost(ride.startTime, endTime);

    const updatedRide = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        endTime, cost, status: 'completed',
        endLat: scooter.lat, endLng: scooter.lng,
        nearestHub: nearHub?.name || null,
      },
    });

    const updatedScooter = await prisma.scooter.update({
      where: { id: scooter.id },
      data: {
        status: 'available', locked: true, currentRideId: null,
        hubId: nearHub?.id || scooter.hubId, totalRides: { increment: 1 },
      },
    });
    await prisma.user.update({ where: { id: req.user.id }, data: { totalRides: { increment: 1 } } });
    await refreshScooter(scooter.id);

    const paymentResult = await chargeRide(req.user, updatedRide);

    // Push notification — fire and forget
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fcmToken: true } });
    const costFormatted = `R$ ${cost.toFixed(2).replace('.', ',')}`;

    if (paymentResult.status === 'paid') {
      fcm.send(user?.fcmToken, {
        title: '✅ Corrida finalizada',
        body:  `Total cobrado: ${costFormatted}. Obrigado!`,
        data:  { rideId: ride.id, type: 'ride_end', cost: String(cost) },
      });
    } else if (paymentResult.status === 'failed') {
      fcm.send(user?.fcmToken, {
        title: '⚠️ Falha no pagamento',
        body:  `Não conseguimos cobrar ${costFormatted}. Toque para resolver.`,
        data:  { rideId: ride.id, type: 'payment_failed', cost: String(cost) },
      });
    } else {
      fcm.send(user?.fcmToken, {
        title: '✅ Corrida finalizada',
        body:  `Duração: ${Math.round((endTime - new Date(ride.startTime)) / 60000)} min — ${costFormatted}`,
        data:  { rideId: ride.id, type: 'ride_end', cost: String(cost) },
      });
    }

    res.json({
      ride: { ...updatedRide, paymentStatus: paymentResult.status },
      scooter: updatedScooter,
      payment: paymentResult,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/rides/my
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const rides = await prisma.ride.findMany({
      where:   { userId: req.user.id },
      orderBy: { startTime: 'desc' },
      include: { scooter: { select: { name: true } } },
    });
    res.json(rides.map((r) => ({ ...r, scooterName: r.scooter?.name, userName: req.user.name })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rides/active
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const ride = await prisma.ride.findFirst({ where: { userId: req.user.id, status: 'active' } });
    if (!ride) return res.json(null);
    const scooter = await prisma.scooter.findUnique({ where: { id: ride.scooterId } });
    res.json({ ride, scooter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rides/pricing
router.get('/pricing', (_req, res) => {
  res.json({ unlockFee: UNLOCK_FEE, pricePerMin: PRICE_PER_MIN });
});

// POST /api/rides/:id/photo — foto de devolução do patinete
router.post('/:id/photo', authMiddleware, (req, res, next) => {
  uploadRidePhoto.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride)                       return res.status(404).json({ error: 'Corrida não encontrada' });
    if (ride.userId !== req.user.id) return res.status(403).json({ error: 'Não autorizado' });
    if (!req.file)                   return res.status(400).json({ error: 'Nenhuma foto enviada' });

    const returnPhotoUrl = `/uploads/rides/${req.file.filename}`;
    await prisma.ride.update({ where: { id: req.params.id }, data: { returnPhotoUrl } });
    res.json({ returnPhotoUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
