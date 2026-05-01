require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const prisma   = require('./db');

const authRoutes    = require('./routes/auth');
const scooterRoutes = require('./routes/scooters');
const rideRoutes    = require('./routes/rides');
const adminRoutes   = require('./routes/admin');
const gpsSimulator  = require('./services/gpsSimulator');

const app    = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://192.168.31.230:3000',
  'http://192.168.31.230:3001',
];

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${new Date().toLocaleTimeString('pt-BR')} ${req.method} ${req.path}`);
  next();
});

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/scooters', scooterRoutes);
app.use('/api/rides',    rideRoutes);
app.use('/api/admin',    adminRoutes);

// Mapa público
app.get('/api/map', async (req, res) => {
  try {
    const [zones, hubs] = await Promise.all([
      prisma.zone.findMany(),
      prisma.hub.findMany(),
    ]);
    const scooters = gpsSimulator.getCache().filter(
      (s) => s.status === 'available' && s.battery >= 10
    );
    res.json({
      zones: zones.map(z => ({
        id: z.id, name: z.name, color: z.color, radius: z.radius,
        center: { lat: z.centerLat, lng: z.centerLng },
      })),
      hubs,
      scooters,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: 'postgresql', timestamp: new Date().toISOString() });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  // Enviar estado inicial
  socket.emit('scooters_update', gpsSimulator.getCache());

  const [zones, hubs] = await Promise.all([
    prisma.zone.findMany(),
    prisma.hub.findMany(),
  ]);
  socket.emit('zones_update', zones.map(z => ({
    id: z.id, name: z.name, color: z.color, radius: z.radius,
    center: { lat: z.centerLat, lng: z.centerLng },
  })));
  socket.emit('hubs_update', hubs);

  socket.on('disconnect', () => console.log(`🔌 Desconectado: ${socket.id}`));
});

gpsSimulator.setIO(io);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  // Testar conexão com o banco antes de subir
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL conectado');
  } catch (err) {
    console.error('❌ Erro ao conectar no PostgreSQL:', err.message);
    console.error('   Verifique o arquivo .env e se o PostgreSQL está rodando.');
    process.exit(1);
  }

  await gpsSimulator.startSimulation();

  server.listen(PORT, () => {
    console.log(`\n🛴  ZipRide Backend rodando em http://localhost:${PORT}`);
    console.log(`📡  Socket.IO ativo`);
    console.log(`\nCredenciais de teste:`);
    console.log(`  Admin:   admin@patinete.com / admin123`);
    console.log(`  Usuário: joao@teste.com    / 123456\n`);
  });
}

start();

// Fechar conexão Prisma ao encerrar
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
