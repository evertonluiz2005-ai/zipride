require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const prisma   = require('./db');

const authRoutes     = require('./routes/auth');
const scooterRoutes  = require('./routes/scooters');
const rideRoutes     = require('./routes/rides');
const adminRoutes    = require('./routes/admin');
const paymentRoutes  = require('./routes/payments');
const deviceRoutes   = require('./routes/device');
const gpsSimulator   = require('./services/gpsSimulator');
const fcm            = require('./services/fcm');
const { authLimiter, apiLimiter, deviceLimiter } = require('./middleware/rateLimiter');

const app    = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});

// ─── Webhook do Stripe ANTES do express.json() (precisa de raw body) ─────────
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ─── Middlewares gerais ───────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${new Date().toLocaleTimeString('pt-BR')} ${req.method} ${req.path}`);
  next();
});

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter,  authRoutes);
app.use('/api/scooters', apiLimiter,   scooterRoutes);
app.use('/api/rides',    apiLimiter,   rideRoutes);
app.use('/api/admin',    apiLimiter,   adminRoutes);
app.use('/api/payments', apiLimiter,   paymentRoutes);
app.use('/api/device',   deviceLimiter, deviceRoutes);

// Mapa público
app.get('/api/map', async (req, res) => {
  try {
    const [zones, hubs] = await Promise.all([
      prisma.zone.findMany(),
      prisma.hub.findMany(),
    ]);
    res.json({
      zones: zones.map(z => ({ id: z.id, name: z.name, color: z.color, coordinates: z.coordinates })),
      hubs,
      scooters: gpsSimulator.getCache().filter(s => s.status === 'available' && s.battery >= 10),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: 'postgresql',
    stripe: !!process.env.STRIPE_SECRET_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);
  socket.emit('scooters_update', gpsSimulator.getCache());
  const [zones, hubs] = await Promise.all([prisma.zone.findMany(), prisma.hub.findMany()]);
  socket.emit('zones_update', zones.map(z => ({
    id: z.id, name: z.name, color: z.color, coordinates: z.coordinates,
  })));
  socket.emit('hubs_update', hubs);
  socket.on('disconnect', () => console.log(`🔌 Desconectado: ${socket.id}`));
});

gpsSimulator.setIO(io);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL conectado');
  } catch (err) {
    console.error('❌ Erro ao conectar no PostgreSQL:', err.message);
    process.exit(1);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY não configurada — pagamentos desativados');
  } else {
    console.log('💳 Stripe configurado');
  }

  fcm.init();
  await gpsSimulator.startSimulation();

  server.listen(PORT, () => {
    console.log(`\n🛴  ZipRide Backend → http://localhost:${PORT}`);
    console.log(`📡  Socket.IO ativo`);
    console.log(`\n  Admin:   admin@patinete.com / admin123`);
    console.log(`  Usuário: joao@teste.com    / 123456\n`);
  });
}

start();
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
