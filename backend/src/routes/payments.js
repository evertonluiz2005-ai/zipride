// src/routes/payments.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma  = require('../db');
const { authMiddleware }    = require('../middleware/auth');
const {
  stripe,
  createSetupIntent,
  savePaymentMethod,
  removePaymentMethod,
  retryRidePayment,
} = require('../services/stripe');

const router = express.Router();

function pixReference() {
  return 'PIX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function formatCNPJ(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

// ─── GET /api/payments/card ───────────────────────────────────────────────────
router.get('/card', authMiddleware, (req, res) => {
  const { stripePaymentMethodId, cardBrand, cardLast4, cardExpMonth, cardExpYear } = req.user;
  if (!stripePaymentMethodId) return res.json({ hasCard: false });
  res.json({ hasCard: true, brand: cardBrand, last4: cardLast4, expMonth: cardExpMonth, expYear: cardExpYear });
});

// ─── POST /api/payments/setup-intent ─────────────────────────────────────────
router.post('/setup-intent', authMiddleware, async (req, res) => {
  try {
    res.json(await createSetupIntent(req.user));
  } catch (err) {
    console.error('SetupIntent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/payments/save-card ────────────────────────────────────────────
router.post('/save-card', authMiddleware, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId obrigatório' });
    const card = await savePaymentMethod(req.user, paymentMethodId);
    res.json({ success: true, card });
  } catch (err) {
    console.error('Save card error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/payments/card ────────────────────────────────────────────────
router.delete('/card', authMiddleware, async (req, res) => {
  try {
    await removePaymentMethod(req.user);
    res.json({ success: true });
  } catch (err) {
    console.error('Remove card error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/payments/retry/:rideId ────────────────────────────────────────
router.post('/retry/:rideId', authMiddleware, async (req, res) => {
  try {
    res.json(await retryRidePayment(req.user, req.params.rideId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/payments/publishable-key ───────────────────────────────────────
router.get('/publishable-key', (req, res) => {
  res.json({ key: process.env.STRIPE_PUBLISHABLE_KEY });
});

// ─── POST /api/payments/pix ──────────────────────────────────────────────────
// Gera uma cobrança Pix manual: retorna a chave Pix + código de referência
router.post('/pix', authMiddleware, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount < 5)  return res.status(400).json({ error: 'Valor mínimo é R$ 5,00' });
    if (amount > 500)                             return res.status(400).json({ error: 'Valor máximo é R$ 500,00' });

    const reference = pixReference();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    const recharge = await prisma.pixRecharge.create({
      data: {
        id: uuidv4(),
        userId:    req.user.id,
        amount,
        reference,
        pixCode:   process.env.PIX_KEY || '',
        expiresAt,
      },
    });

    const pixKey = process.env.PIX_KEY || '';
    const pixKeyType = process.env.PIX_KEY_TYPE || 'cnpj';
    res.json({
      rechargeId:      recharge.id,
      reference:       recharge.reference,
      pixKey,
      pixKeyFormatted: pixKeyType === 'cnpj' ? formatCNPJ(pixKey) : pixKey,
      pixKeyType,
      beneficiaryName: process.env.PIX_BENEFICIARY_NAME || 'ZipRide',
      amount,
      expiresAt:       recharge.expiresAt,
    });
  } catch (err) {
    console.error('Pix error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/payments/pix/:rechargeId/status ────────────────────────────────
// Polling de status — frontend consulta a cada 5s para detectar aprovação
router.get('/pix/:rechargeId/status', authMiddleware, async (req, res) => {
  try {
    const recharge = await prisma.pixRecharge.findUnique({ where: { id: req.params.rechargeId } });
    if (!recharge || recharge.userId !== req.user.id)
      return res.status(404).json({ error: 'Recarga não encontrada' });

    if (recharge.status === 'pending' && recharge.expiresAt < new Date()) {
      await prisma.pixRecharge.update({ where: { id: req.params.rechargeId }, data: { status: 'expired' } });
      return res.json({ status: 'expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ status: recharge.status, balance: user.balance, rejectedReason: recharge.rejectedReason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        if (pi.metadata?.rideId) {
          await prisma.ride.updateMany({
            where: { paymentIntentId: pi.id },
            data:  { paymentStatus: 'paid' },
          });
          console.log(`✅ Corrida paga — ${pi.metadata.rideId.slice(0, 8)}`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        if (pi.metadata?.rideId) {
          await prisma.ride.updateMany({
            where: { paymentIntentId: pi.id },
            data: {
              paymentStatus: 'failed',
              paymentError:  pi.last_payment_error?.message || 'Pagamento recusado',
            },
          });
          console.warn(`❌ Corrida falhou — ${pi.metadata.rideId.slice(0, 8)}`);
        }
        break;
      }

      case 'customer.deleted': {
        const customer = event.data.object;
        await prisma.user.updateMany({
          where: { stripeCustomerId: customer.id },
          data: {
            stripeCustomerId:      null,
            stripePaymentMethodId: null,
            cardBrand:    null,
            cardLast4:    null,
            cardExpMonth: null,
            cardExpYear:  null,
          },
        });
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  }
);

module.exports = router;
