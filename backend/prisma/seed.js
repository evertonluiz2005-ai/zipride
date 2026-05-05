// prisma/seed.js
// Executa com: node prisma/seed.js
// Ou via: npm run db:seed

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ─── Limpar dados existentes (ordem importa por FK) ──────────────────────
  await prisma.ride.deleteMany();
  await prisma.scooter.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️  Dados anteriores removidos');

  // ─── Zonas (Campo Mourão, PR) — polígonos ─────────────────────────────────
  const zoneCentro = await prisma.zone.create({
    data: {
      id: 'zone-centro',
      name: 'Centro',
      color: '#3B82F6',
      coordinates: [
        [-24.0390, -52.3890], [-24.0390, -52.3770],
        [-24.0510, -52.3770], [-24.0510, -52.3890],
      ],
    },
  });

  const zoneUnicentro = await prisma.zone.create({
    data: {
      id: 'zone-unicentro',
      name: 'Universidade (UNICENTRO)',
      color: '#10B981',
      coordinates: [
        [-24.0490, -52.3790], [-24.0490, -52.3670],
        [-24.0610, -52.3670], [-24.0610, -52.3790],
      ],
    },
  });

  const zoneShopping = await prisma.zone.create({
    data: {
      id: 'zone-shopping',
      name: 'Shopping Avenida',
      color: '#F59E0B',
      coordinates: [
        [-24.0290, -52.3990], [-24.0290, -52.3870],
        [-24.0410, -52.3870], [-24.0410, -52.3990],
      ],
    },
  });

  console.log('✅ Zonas criadas:', [zoneCentro, zoneUnicentro, zoneShopping].map(z => z.name).join(', '));

  // ─── Hubs ─────────────────────────────────────────────────────────────────
  const hub01 = await prisma.hub.create({
    data: {
      id: 'hub-01',
      name: 'Hub Centro - Praça da Bandeira',
      lat: -24.0449,
      lng: -52.3831,
      capacity: 8,
      zoneId: zoneCentro.id,
    },
  });

  const hub02 = await prisma.hub.create({
    data: {
      id: 'hub-02',
      name: 'Hub UNICENTRO - Entrada Principal',
      lat: -24.0549,
      lng: -52.3731,
      capacity: 6,
      zoneId: zoneUnicentro.id,
    },
  });

  const hub03 = await prisma.hub.create({
    data: {
      id: 'hub-03',
      name: 'Hub Shopping Avenida',
      lat: -24.0349,
      lng: -52.3931,
      capacity: 6,
      zoneId: zoneShopping.id,
    },
  });

  const hub04 = await prisma.hub.create({
    data: {
      id: 'hub-04',
      name: 'Hub Terminal Rodoviário',
      lat: -24.0412,
      lng: -52.3795,
      capacity: 4,
      zoneId: zoneCentro.id,
    },
  });

  console.log('✅ Hubs criados:', [hub01, hub02, hub03, hub04].map(h => h.name).join(', '));

  // ─── Patinetes ────────────────────────────────────────────────────────────
  const scooters = await Promise.all([
    prisma.scooter.create({
      data: {
        id: 'SCT-001',
        name: 'Patinete #001',
        model: 'Segway Ninebot E2',
        status: 'available',
        locked: true,
        battery: 87,
        lat: -24.0449,
        lng: -52.3831,
        hubId: hub01.id,
        totalRides: 12,
      },
    }),
    prisma.scooter.create({
      data: {
        id: 'SCT-002',
        name: 'Patinete #002',
        model: 'Segway Ninebot E2',
        status: 'available',
        locked: true,
        battery: 64,
        lat: -24.0551,
        lng: -52.3729,
        hubId: hub02.id,
        totalRides: 8,
      },
    }),
    prisma.scooter.create({
      data: {
        id: 'SCT-003',
        name: 'Patinete #003',
        model: 'Xiaomi Mi Pro 2',
        status: 'available',
        locked: true,
        battery: 95,
        lat: -24.0351,
        lng: -52.3929,
        hubId: hub03.id,
        totalRides: 22,
      },
    }),
    prisma.scooter.create({
      data: {
        id: 'SCT-004',
        name: 'Patinete #004',
        model: 'Xiaomi Mi Pro 2',
        status: 'offline',
        locked: true,
        battery: 8,
        lat: -24.0412,
        lng: -52.3795,
        hubId: hub04.id,
        totalRides: 31,
      },
    }),
    prisma.scooter.create({
      data: {
        id: 'SCT-005',
        name: 'Patinete #005',
        model: 'Segway Ninebot E2',
        status: 'available',
        locked: true,
        battery: 42,
        lat: -24.0455,
        lng: -52.3820,
        hubId: hub01.id,
        totalRides: 5,
      },
    }),
  ]);

  console.log('✅ Patinetes criados:', scooters.map(s => s.id).join(', '));

  // ─── Usuários ─────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Sistema',
      email: 'admin@patinete.com',
      phone: '44999990000',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      balance: 100.0,
      cpf: '00000000191',
      documentStatus: 'approved',
    },
  });

  const testUser = await prisma.user.create({
    data: {
      name: 'João Teste',
      email: 'joao@teste.com',
      phone: '44988887777',
      password: await bcrypt.hash('123456', 10),
      role: 'user',
      balance: 50.0,
      totalRides: 3,
      cpf: '52998224725',
      documentStatus: 'approved',
    },
  });

  console.log('✅ Usuários criados:', [adminUser, testUser].map(u => `${u.name} (${u.role})`).join(', '));

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\nCredenciais:');
  console.log('  Admin:   admin@patinete.com / admin123');
  console.log('  Usuário: joao@teste.com    / 123456');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
