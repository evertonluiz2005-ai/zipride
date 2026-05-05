const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const prisma  = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// ─── Multer — upload de documento ─────────────────────────────────────────────
const { UPLOADS_DIR } = require('../config');
const DOC_DIR = path.join(UPLOADS_DIR, 'documents');
fs.mkdirSync(DOC_DIR, { recursive: true });

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOC_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const uploadDoc = multer({
  storage: docStorage,
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
});

const router = express.Router();

const REFRESH_TOKEN_DAYS = 30;

function validateCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

function makeAccessToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
}

async function makeRefreshToken(userId) {
  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { id: uuidv4(), token, userId, expiresAt } });
  return token;
}

function safeUser(user) {
  const { password: _, ...u } = user;
  return u;
}

// ─── Registro email/senha ─────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, cpf, lgpdAccepted } = req.body;
    if (!name || !email || !password || !cpf)
      return res.status(400).json({ error: 'Nome, email, CPF e senha são obrigatórios' });

    const cpfClean = cpf.replace(/\D/g, '');
    if (!validateCPF(cpfClean))
      return res.status(400).json({ error: 'CPF inválido' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

    const cpfExists = await prisma.user.findUnique({ where: { cpf: cpfClean } });
    if (cpfExists) return res.status(409).json({ error: 'CPF já cadastrado' });

    const user = await prisma.user.create({
      data: {
        name, email, phone: phone || null,
        password: await bcrypt.hash(password, 10),
        role: 'user', balance: 20.0,
        cpf: cpfClean,
        lgpdAcceptedAt: lgpdAccepted ? new Date() : null,
      },
    });

    const token        = makeAccessToken(user.id);
    const refreshToken = await makeRefreshToken(user.id);
    res.status(201).json({ token, refreshToken, user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Login email/senha ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(401).json({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token        = makeAccessToken(user.id);
    const refreshToken = await makeRefreshToken(user.id);
    res.json({ token, refreshToken, user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── OAuth Google ─────────────────────────────────────────────────────────────
// Recebe o accessToken retornado pelo @react-oauth/google no frontend
router.post('/google', async (req, res) => {
  try {
    const { accessToken, lgpdAccepted } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken obrigatório' });

    const gRes = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`
    );
    if (!gRes.ok) return res.status(401).json({ error: 'Token Google inválido' });
    const gUser = await gRes.json();

    const { id: oauthId, name, email } = gUser;
    if (!email) return res.status(400).json({ error: 'Email não disponível no Google' });

    let user = await prisma.user.findFirst({
      where: { OR: [{ oauthId, oauthProvider: 'google' }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name, email,
          oauthProvider: 'google', oauthId,
          role: 'user', balance: 20.0,
          lgpdAcceptedAt: lgpdAccepted ? new Date() : null,
        },
      });
    } else {
      const update = {};
      if (!user.oauthId) { update.oauthProvider = 'google'; update.oauthId = oauthId; }
      if (lgpdAccepted && !user.lgpdAcceptedAt) update.lgpdAcceptedAt = new Date();
      if (Object.keys(update).length)
        user = await prisma.user.update({ where: { id: user.id }, data: update });
    }

    const token        = makeAccessToken(user.id);
    const refreshToken = await makeRefreshToken(user.id);
    res.json({ token, refreshToken, user: safeUser(user), needsCpf: !user.cpf });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── OAuth Facebook ───────────────────────────────────────────────────────────
// Recebe o accessToken do SDK do Facebook no frontend
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken, lgpdAccepted } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken obrigatório' });

    const FACEBOOK_APP_ID     = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

    if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`
      );
      const debug = await debugRes.json();
      if (!debug.data?.is_valid || String(debug.data?.app_id) !== String(FACEBOOK_APP_ID)) {
        return res.status(401).json({ error: 'Token Facebook inválido' });
      }
    }

    const fbRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`
    );
    const fbUser = await fbRes.json();
    if (fbUser.error) return res.status(401).json({ error: 'Token Facebook inválido' });

    const { id: oauthId, name, email } = fbUser;
    if (!email) return res.status(400).json({ error: 'Email não disponível no Facebook. Verifique as permissões do app.' });

    let user = await prisma.user.findFirst({
      where: { OR: [{ oauthId, oauthProvider: 'facebook' }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name, email,
          oauthProvider: 'facebook', oauthId,
          role: 'user', balance: 20.0,
          lgpdAcceptedAt: lgpdAccepted ? new Date() : null,
        },
      });
    } else {
      const update = {};
      if (!user.oauthId) { update.oauthProvider = 'facebook'; update.oauthId = oauthId; }
      if (lgpdAccepted && !user.lgpdAcceptedAt) update.lgpdAcceptedAt = new Date();
      if (Object.keys(update).length)
        user = await prisma.user.update({ where: { id: user.id }, data: update });
    }

    const token        = makeAccessToken(user.id);
    const refreshToken = await makeRefreshToken(user.id);
    res.json({ token, refreshToken, user: safeUser(user), needsCpf: !user.cpf });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Completar perfil OAuth (adicionar CPF) ───────────────────────────────────
router.post('/complete-profile', authMiddleware, async (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ error: 'CPF obrigatório' });

    const cpfClean = cpf.replace(/\D/g, '');
    if (!validateCPF(cpfClean))
      return res.status(400).json({ error: 'CPF inválido' });

    const exists = await prisma.user.findFirst({
      where: { cpf: cpfClean, NOT: { id: req.user.id } },
    });
    if (exists) return res.status(409).json({ error: 'CPF já cadastrado' });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { cpf: cpfClean },
    });
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Refresh token ────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatório' });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date())
      return res.status(401).json({ error: 'Refresh token inválido ou expirado' });

    const token = makeAccessToken(stored.userId);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Upload de documento de identidade ───────────────────────────────────────
router.post('/upload-document', authMiddleware, (req, res, next) => {
  uploadDoc.single('document')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const imageUrl = `/uploads/documents/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data:  {
        documentImageUrl:       imageUrl,
        documentStatus:         'pending',
        documentRejectedReason: null,
      },
    });

    res.json({ documentImageUrl: imageUrl, documentStatus: user.documentStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Imagem do documento (somente o próprio usuário) ─────────────────────────
router.get('/document-image', authMiddleware, (req, res) => {
  const { documentImageUrl } = req.user;
  if (!documentImageUrl) return res.status(404).json({ error: 'Nenhum documento enviado' });

  const filename = path.basename(documentImageUrl);
  const filepath = path.join(DOC_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Arquivo não encontrado' });

  res.sendFile(filepath);
});

// ─── FCM token ────────────────────────────────────────────────────────────────
router.post('/fcm-token', authMiddleware, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken obrigatório' });
    await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json(safeUser(req.user));
});

module.exports = router;
