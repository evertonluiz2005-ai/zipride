#!/bin/bash
# ─── ZipRide MVP — Script de inicialização ───────────────────────────────────
# Inicia backend, frontend do usuário e painel admin em paralelo.
# Requer: Node.js 18+, npm 8+

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}  ⚡ ZipRide MVP — Iniciando todos os serviços...${RESET}"
echo ""

# Verificar dependências
if ! command -v node &> /dev/null; then
  echo "❌  Node.js não encontrado. Instale via https://nodejs.org"
  exit 1
fi

echo -e "${YELLOW}[1/3]${RESET} Instalando dependências..."
(cd backend  && npm install --silent)
(cd frontend && npm install --silent)
(cd admin    && npm install --silent)
echo -e "${GREEN}✓${RESET} Dependências instaladas"

echo ""
echo -e "${YELLOW}[2/3]${RESET} Iniciando Backend (porta 4000)..."
(cd backend && npm run dev) &
sleep 3

echo -e "${GREEN}✓${RESET} Backend rodando em ${CYAN}http://localhost:4000${RESET}"
echo ""

echo -e "${YELLOW}[3/3]${RESET} Iniciando Frontend (porta 3000) e Admin (porta 3001)..."
(cd frontend && npm start) &
sleep 2
(cd admin    && npm start) &

echo ""
echo -e "${GREEN}════════════════════════════════════════════${RESET}"
echo -e "${GREEN}  ✅ Todos os serviços iniciados!${RESET}"
echo ""
echo -e "  🛴  App do usuário:  ${CYAN}http://localhost:3000${RESET}"
echo -e "  🖥️   Painel admin:   ${CYAN}http://localhost:3001${RESET}"
echo -e "  📡  API Backend:    ${CYAN}http://localhost:4000/api${RESET}"
echo ""
echo -e "  👤 Usuário demo:  joao@teste.com / 123456"
echo -e "  🔑 Admin:         admin@patinete.com / admin123"
echo -e "${GREEN}════════════════════════════════════════════${RESET}"
echo ""
echo "Pressione Ctrl+C para encerrar todos os serviços."

# Aguardar sinal
wait
