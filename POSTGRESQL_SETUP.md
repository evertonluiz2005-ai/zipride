# 🗄️ Guia de Migração para PostgreSQL — ZipRide MVP

## Por que trocar o armazenamento em memória?

| In-Memory (antes)         | PostgreSQL (agora)                  |
|---------------------------|-------------------------------------|
| Dados somem ao reiniciar  | Dados persistem para sempre         |
| Sem histórico de corridas | Histórico completo no banco         |
| Não escala                | Suporta milhares de usuários        |
| Uma instância só          | Deploy em qualquer servidor         |

---

## PASSO 1 — Instalar PostgreSQL no Windows

1. Acesse: **https://www.postgresql.org/download/windows/**
2. Clique em **"Download the installer"** (versão 16 ou 15)
3. Execute o instalador:
   - **Senha do postgres:** escolha uma (ex: `postgres123`) — **anote essa senha!**
   - **Porta:** 5432 (padrão, não mude)
   - Marque para instalar o **pgAdmin 4** também (interface gráfica)
4. Conclua a instalação

---

## PASSO 2 — Criar o banco de dados

### Opção A — Via pgAdmin (interface gráfica, mais fácil)
1. Abra o **pgAdmin 4** (instalado junto)
2. Conecte ao servidor local com a senha que você definiu
3. Clique com botão direito em **Databases** → **Create** → **Database**
4. Nome: `zipride` → clique **Save**

### Opção B — Via linha de comando
Abra o CMD e execute:
```
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE zipride;"
```
Digite a senha quando solicitado.

---

## PASSO 3 — Configurar o arquivo .env

Na pasta `backend/`, crie um arquivo chamado `.env`:

```
DATABASE_URL="postgresql://postgres:SUA_SENHA_AQUI@localhost:5432/zipride"
JWT_SECRET="zipride-secret-mude-em-producao-2024"
PORT=4000
```

⚠️ **Substitua `SUA_SENHA_AQUI`** pela senha que você definiu na instalação.

Exemplo se a senha for `postgres123`:
```
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/zipride"
```

---

## PASSO 4 — Instalar dependências e configurar Prisma

No CMD, dentro da pasta `backend/`:

```bash
# Instalar dependências (incluindo Prisma e cliente PostgreSQL)
npm install

# Gerar o cliente Prisma
npx prisma generate

# Criar as tabelas no banco (executa a migration)
npx prisma migrate dev --name init
```

Você verá algo como:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your schema.
```

---

## PASSO 5 — Popular o banco com dados iniciais (seed)

```bash
node prisma/seed.js
```

Saída esperada:
```
🌱 Iniciando seed do banco de dados...
✅ Zonas criadas: Centro, Universidade (UNICENTRO), Shopping Avenida
✅ Hubs criados: Hub Centro - Praça da Bandeira, ...
✅ Patinetes criados: SCT-001, SCT-002, SCT-003, SCT-004, SCT-005
✅ Usuários criados: Admin Sistema (admin), João Teste (user)
🎉 Seed concluído com sucesso!
```

---

## PASSO 6 — Iniciar o backend

```bash
npm run dev
```

Saída esperada:
```
✅ PostgreSQL conectado
🛰️  Simulação de GPS iniciada (cache em memória + flush DB a cada 30s)
🛴  ZipRide Backend rodando em http://localhost:4000
```

---

## ✅ Verificar se está funcionando

```bash
# Health check
curl http://localhost:4000/api/health
# Deve retornar: {"status":"ok","db":"postgresql",...}

# Login
curl -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@patinete.com\",\"password\":\"admin123\"}"
```

---

## 🔧 Comandos úteis do Prisma

```bash
# Visualizar banco no navegador (interface gráfica)
npx prisma studio
# Acesse: http://localhost:5555

# Recriar banco do zero (apaga tudo e popula de novo)
npm run db:reset

# Ver status das migrations
npx prisma migrate status

# Aplicar migration em produção
npx prisma migrate deploy
```

---

## ☁️ Banco gratuito na nuvem (para deploy)

Se quiser usar banco online sem instalar nada local:

### Neon (recomendado — gratuito)
1. Acesse **https://neon.tech** e crie uma conta
2. Crie um projeto `zipride`
3. Copie a **Connection String** (começa com `postgresql://...`)
4. Cole no seu `.env`:
   ```
   DATABASE_URL="postgresql://user:pass@ep-xxxxx.neon.tech/zipride?sslmode=require"
   ```

### Supabase (alternativa)
1. Acesse **https://supabase.com** e crie um projeto
2. Em **Settings → Database**, copie a URI de conexão
3. Cole no `.env`

---

## 🛠️ Troubleshooting

| Erro | Solução |
|------|---------|
| `password authentication failed` | Verifique a senha no `.env` |
| `database "zipride" does not exist` | Crie o banco (Passo 2) |
| `connect ECONNREFUSED` | PostgreSQL não está rodando — abra o Services do Windows e inicie o serviço `postgresql-x64-16` |
| `P1001: Can't reach database` | Mesma causa acima |
| `prisma generate` falha | Execute `npm install` antes |

---

## 📁 Arquivos novos/modificados nesta atualização

```
backend/
├── .env.example          ← Template das variáveis (copie para .env)
├── prisma/
│   ├── schema.prisma     ← Definição das tabelas
│   └── seed.js           ← Dados iniciais (5 patinetes, 4 hubs, 3 zonas)
└── src/
    ├── db.js             ← Singleton do Prisma Client
    ├── index.js          ← Atualizado (conecta no DB antes de subir)
    ├── middleware/auth.js ← Atualizado (async com Prisma)
    ├── routes/
    │   ├── auth.js       ← Reescrito (async/await)
    │   ├── scooters.js   ← Reescrito (async/await)
    │   ├── rides.js      ← Reescrito (async/await)
    │   └── admin.js      ← Reescrito (async/await, queries agregadas)
    └── services/
        ├── geofence.js   ← Atualizado (cache de zonas/hubs do DB)
        └── gpsSimulator.js ← Atualizado (cache em memória + flush DB 30s)
```
