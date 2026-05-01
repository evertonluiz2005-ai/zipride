# ⚡ ZipRide MVP — Sistema de Patinetes Elétricos Compartilhados

Sistema completo de micromobilidade para operação local em Campo Mourão, PR.
MVP funcional com app do usuário (React), painel admin (React) e backend (Node.js/Express).

---

## 📁 Estrutura de Pastas

```
scooter-mvp/
│
├── backend/                   # API Node.js + Express + Socket.IO
│   └── src/
│       ├── index.js           # Entry point — Express + Socket.IO + simulação GPS
│       ├── store.js           # Banco em memória (seed: 5 patinetes, 4 hubs, 3 zonas)
│       ├── middleware/
│       │   └── auth.js        # JWT middleware (authMiddleware, adminMiddleware)
│       ├── routes/
│       │   ├── auth.js        # POST /login, /register, GET /me
│       │   ├── scooters.js    # GET /scooters, POST /lockScooter, /unlockScooter
│       │   ├── rides.js       # POST /start, /:id/end, GET /my, /active
│       │   └── admin.js       # Dashboard, frota, corridas, hubs (admin only)
│       └── services/
│           ├── geofence.js    # Haversine, isInAllowedZone, isNearHub
│           └── gpsSimulator.js# Simula GPS + bateria em tempo real via Socket.IO
│
├── frontend/                  # App do usuário (React, mobile-first)
│   └── src/
│       ├── App.js             # Rotas e PrivateRoute
│       ├── App.css            # Tema dark elétrico (Space Grotesk)
│       ├── api.js             # Serviço HTTP centralizado
│       ├── context/
│       │   └── AuthContext.js # Contexto de autenticação global
│       ├── pages/
│       │   ├── Login.jsx      # Tela de login
│       │   ├── Register.jsx   # Cadastro de usuário
│       │   ├── MapPage.jsx    # Mapa com patinetes, zonas, hubs + modal QR
│       │   ├── RidePage.jsx   # Corrida ativa com timer e custo em tempo real
│       │   └── HistoryPage.jsx# Histórico + perfil do usuário
│       └── components/
│           └── BottomNav.jsx  # Navegação inferior mobile
│
├── admin/                     # Painel administrativo (React, desktop)
│   └── src/
│       ├── App.js             # Layout sidebar + autenticação admin
│       ├── App.css            # Tema dark dashboard
│       ├── api.js             # Serviço HTTP para rotas admin
│       └── pages/
│           ├── Dashboard.jsx  # KPIs: frota, receita, corridas, bateria
│           ├── Fleet.jsx      # Mapa da frota + tabela + lock/unlock
│           ├── Rides.jsx      # Tabela de corridas com filtros
│           └── Hubs.jsx       # CRUD de hubs com posicionamento no mapa
│
├── start.sh                   # Script que inicia todos os 3 serviços
└── package.json               # Scripts convenientes para monorepo
```

---

## 🚀 Como executar localmente

### Pré-requisitos
- **Node.js 18+** — https://nodejs.org
- **npm 8+** (incluso com Node.js)

### Opção 1 — Script automático (recomendado)

```bash
git clone <repo>  # ou extraia o ZIP
cd scooter-mvp
chmod +x start.sh
./start.sh
```

O script instala as dependências e sobe os 3 serviços automaticamente.

### Opção 2 — 3 terminais separados

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev        # porta 4000

# Terminal 2 — App do usuário
cd frontend
npm install
npm start          # porta 3000

# Terminal 3 — Painel admin
cd admin
npm install
PORT=3001 npm start  # porta 3001
```

---

## 🌐 Endereços

| Serviço       | URL                        |
|--------------|----------------------------|
| App usuário   | http://localhost:3000      |
| Painel admin  | http://localhost:3001      |
| API REST      | http://localhost:4000/api  |

---

## 👤 Credenciais de teste (seed)

| Perfil    | Email                    | Senha     |
|-----------|--------------------------|-----------|
| Admin     | admin@patinete.com       | admin123  |
| Usuário   | joao@teste.com           | 123456    |

---

## 🛴 Seed de dados — 5 patinetes simulados

| ID      | Status      | Bateria | Hub                        |
|---------|-------------|---------|----------------------------|
| SCT-001 | available   | 87%     | Hub Centro - Praça Bandeira|
| SCT-002 | available   | 64%     | Hub UNICENTRO              |
| SCT-003 | available   | 95%     | Hub Shopping Avenida       |
| SCT-004 | offline     | 8%      | Hub Terminal Rodoviário    |
| SCT-005 | available   | 42%     | Hub Centro - Praça Bandeira|

> SCT-004 está offline por bateria < 10% (regra de negócio).

---

## 🗺️ Zonas e Hubs (Campo Mourão, PR)

**3 zonas fixas** (geofencing por raio Haversine):

| Zona          | Centro                     | Raio  |
|---------------|----------------------------|-------|
| Centro        | -24.0449, -52.3831         | 600m  |
| UNICENTRO     | -24.0549, -52.3731         | 500m  |
| Shopping Av.  | -24.0349, -52.3931         | 400m  |

**4 hubs fixos:**
- Hub Centro - Praça da Bandeira (cap: 8)
- Hub UNICENTRO - Entrada Principal (cap: 6)
- Hub Shopping Avenida (cap: 6)
- Hub Terminal Rodoviário (cap: 4)

---

## 💰 Regras de negócio e preços

| Regra                        | Valor/Comportamento                       |
|------------------------------|-------------------------------------------|
| Taxa de desbloqueio          | R$ 3,00                                   |
| Preço por minuto             | R$ 0,50                                   |
| Bateria mínima para uso      | 10%                                       |
| Só inicia dentro de zona     | Geofencing via Haversine                  |
| Encerramento                 | Deve estar em hub (±150m) ou zona         |
| 1 corrida por usuário        | Bloqueia nova corrida se há ativa         |
| Bateria < 5%                 | Patinete vai para offline automaticamente |
| Recarga simulada             | +2% a cada 30s se offline                 |

---

## 📡 API REST — Endpoints principais

### Autenticação
```
POST /api/auth/register       { name, email, phone, password }
POST /api/auth/login          { email, password }
GET  /api/auth/me             🔒 token
```

### Mapa (público)
```
GET  /api/map                 zones + hubs + scooters disponíveis
```

### Patinetes
```
GET  /api/scooters            🔒 lista (admin vê todos, usuário vê disponíveis)
POST /api/scooters/lockScooter    🔑 admin { scooterId }
POST /api/scooters/unlockScooter  🔑 admin { scooterId }
PATCH /api/scooters/:id/position  🔑 admin { lat, lng }
```

### Corridas
```
POST /api/rides/start         🔒 { scooterId }
POST /api/rides/:id/end       🔒
GET  /api/rides/active        🔒 corrida ativa do usuário
GET  /api/rides/my            🔒 histórico do usuário
GET  /api/rides/pricing       preços públicos
```

### Admin
```
GET  /api/admin/dashboard     🔑 KPIs gerais
GET  /api/admin/scooters      🔑 frota completa
GET  /api/admin/rides         🔑 todas as corridas
GET  /api/admin/hubs          🔑 todos os hubs
POST /api/admin/hubs          🔑 criar hub { name, lat, lng, zoneId, capacity }
DELETE /api/admin/hubs/:id    🔑 remover hub
```

> 🔒 = JWT de usuário | 🔑 = JWT de admin

---

## 🔌 Socket.IO — Eventos em tempo real

O backend emite eventos para todos os clientes conectados:

| Evento           | Dados                         | Frequência     |
|-----------------|-------------------------------|----------------|
| `scooters_update` | Array completo de patinetes   | A cada 4s      |
| `zones_update`    | Array de zonas                | Na conexão     |
| `hubs_update`     | Array de hubs                 | Na conexão     |

---

## 🛰️ Simulação de GPS

- Patinetes **em uso** se movem aleatoriamente ±11m a cada 4 segundos
- Bateria drena **0.05% por tick** durante uso
- Bateria < 5% → status `offline` automaticamente
- Patinetes offline recarregam +2% a cada 30s (simula recolhimento)
- Admin pode mover patinete manualmente via `PATCH /api/scooters/:id/position`

---

## 🔮 Próximos passos para produção

1. **Banco de dados real** — Substituir `store.js` por PostgreSQL com Prisma ORM
2. **Gateway de pagamento** — Integrar Stripe (já estruturado, só adicionar `stripe.charges.create`)
3. **Hardware IoT** — Substituir simulação por MQTT/BLE com ESP32 nos patinetes
4. **Push notifications** — Firebase Cloud Messaging para alertas ao usuário
5. **App nativo** — Migrar frontend React para React Native (estrutura de hooks já compatível)
6. **Autenticação robusta** — Adicionar refresh tokens, OAuth (Google/Facebook)
7. **Rate limiting** — Express-rate-limit para proteger endpoints
8. **Deploy** — Backend no Railway/Render, Frontend no Vercel

---

## 🧪 Teste manual rápido (curl)

```bash
# 1. Login como usuário
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@teste.com","password":"123456"}' | jq -r '.token')

# 2. Ver patinetes disponíveis
curl -s http://localhost:4000/api/map | jq '.scooters[].id'

# 3. Iniciar corrida
curl -s -X POST http://localhost:4000/api/rides/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"scooterId":"SCT-001"}' | jq '{rideId: .ride.id, status: .scooter.status}'

# 4. Ver corrida ativa
curl -s http://localhost:4000/api/rides/active \
  -H "Authorization: Bearer $TOKEN" | jq '.ride.id'

# 5. Encerrar corrida
RIDE_ID=$(curl -s http://localhost:4000/api/rides/active \
  -H "Authorization: Bearer $TOKEN" | jq -r '.ride.id')
curl -s -X POST http://localhost:4000/api/rides/$RIDE_ID/end \
  -H "Authorization: Bearer $TOKEN" | jq '{cost: .ride.cost, duration: .ride.endTime}'
```

---

*ZipRide MVP — Desenvolvido para validação de operação de micromobilidade em Campo Mourão, PR.*
