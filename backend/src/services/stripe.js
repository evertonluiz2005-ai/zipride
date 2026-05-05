// src/services/stripe.js
// Toda a lógica Stripe centralizada aqui

const Stripe = require('stripe');
const prisma  = require('../db');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// BRL em centavos (Stripe sempre usa menor unidade)
const toBRL = (reais) => Math.round(reais * 100);

// ─── Cliente Stripe ───────────────────────────────────────────────────────────
// Cria ou recupera o Customer Stripe vinculado ao usuário
async function getOrCreateCustomer(user) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name:  user.name,
    phone: user.phone || undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data:  { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ─── SetupIntent (salvar cartão sem cobrar) ───────────────────────────────────
async function createSetupIntent(user) {
  const customerId = await getOrCreateCustomer(user);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // permite cobrar sem o usuário estar na tela
  });

  return { clientSecret: setupIntent.client_secret };
}

// ─── Salvar cartão após confirmação do SetupIntent ────────────────────────────
async function savePaymentMethod(user, paymentMethodId) {
  const customerId = await getOrCreateCustomer(user);

  // Vincular ao customer Stripe
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Definir como método padrão
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // Buscar detalhes do cartão
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const card = pm.card;

  // Salvar no banco
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripePaymentMethodId: paymentMethodId,
      cardBrand:    card.brand,
      cardLast4:    card.last4,
      cardExpMonth: card.exp_month,
      cardExpYear:  card.exp_year,
    },
  });

  return {
    brand:    card.brand,
    last4:    card.last4,
    expMonth: card.exp_month,
    expYear:  card.exp_year,
  };
}

// ─── Remover cartão ───────────────────────────────────────────────────────────
async function removePaymentMethod(user) {
  if (!user.stripePaymentMethodId) return;

  try {
    await stripe.paymentMethods.detach(user.stripePaymentMethodId);
  } catch (e) {
    // Ignora se já foi removido no Stripe
    console.warn('Stripe detach warning:', e.message);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripePaymentMethodId: null,
      cardBrand:    null,
      cardLast4:    null,
      cardExpMonth: null,
      cardExpYear:  null,
    },
  });
}

// ─── Cobrar corrida ───────────────────────────────────────────────────────────
// Chamado automaticamente ao encerrar corrida
async function chargeRide(user, ride) {
  // Sem cartão — tenta debitar saldo (Pix/créditos)
  if (!user.stripePaymentMethodId || !user.stripeCustomerId) {
    if (user.balance >= ride.cost) {
      await prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: ride.cost } } });
      await prisma.ride.update({ where: { id: ride.id }, data: { paymentStatus: 'paid' } });
      return { status: 'paid', message: 'Pago com saldo' };
    }
    // Saldo insuficiente e sem cartão
    await prisma.ride.update({ where: { id: ride.id }, data: { paymentStatus: 'pending' } });
    return { status: 'pending', message: 'Saldo insuficiente e sem cartão' };
  }

  const amountCents = toBRL(ride.cost);

  // Valor mínimo do Stripe é R$ 0,50 (50 centavos)
  if (amountCents < 50) {
    await prisma.ride.update({
      where: { id: ride.id },
      data: { paymentStatus: 'free' },
    });
    return { status: 'free', message: 'Valor abaixo do mínimo' };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:               amountCents,
      currency:             'brl',
      customer:             user.stripeCustomerId,
      payment_method:       user.stripePaymentMethodId,
      off_session:          true,   // cobrança sem usuário na tela
      confirm:              true,   // confirmar imediatamente
      description:          `ZipRide — corrida ${ride.id.slice(0, 8)}`,
      statement_descriptor: 'ZIPRIDE PATINETE',
      metadata: {
        rideId:    ride.id,
        userId:    user.id,
        scooterId: ride.scooterId,
      },
    });

    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        paymentStatus:   'paid',
        paymentIntentId: paymentIntent.id,
      },
    });

    return { status: 'paid', paymentIntentId: paymentIntent.id };

  } catch (err) {
    // Cartão recusado, sem fundos, etc.
    const errorMsg = err.raw?.message || err.message;

    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        paymentStatus: 'failed',
        paymentError:  errorMsg,
      },
    });

    return { status: 'failed', message: errorMsg };
  }
}

// ─── Retentar pagamento de corrida pendente/falha ─────────────────────────────
async function retryRidePayment(user, rideId) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw new Error('Corrida não encontrada');
  if (ride.userId !== user.id) throw new Error('Não autorizado');
  if (ride.paymentStatus === 'paid') throw new Error('Corrida já foi paga');
  if (!ride.cost) throw new Error('Corrida sem valor calculado');

  return chargeRide(user, ride);
}

// ─── Criar pagamento Pix (recarga de saldo) ───────────────────────────────────
async function createPixPayment(user, amount) {
  const amountCents = toBRL(amount);
  if (amountCents < 500) throw new Error('Valor mínimo de recarga é R$ 5,00');
  if (amountCents > 50000) throw new Error('Valor máximo de recarga é R$ 500,00');

  const paymentIntent = await stripe.paymentIntents.create({
    amount:               amountCents,
    currency:             'brl',
    payment_method_types: ['pix'],
    payment_method_data:  { type: 'pix' },
    confirm:              true,
    return_url:           process.env.FRONTEND_URL || 'http://localhost:3000',
    description:          'ZipRide — recarga de saldo',
    metadata: {
      userId: user.id,
      type:   'balance_recharge',
      amount: String(amount),
    },
  });

  const qrData       = paymentIntent.next_action?.pix_display_qr_code;
  const expiresAfter = qrData?.expires_after_seconds || 3600;
  const expiresAt    = new Date(Date.now() + expiresAfter * 1000);

  await prisma.pixRecharge.create({
    data: {
      id:              require('uuid').v4(),
      userId:          user.id,
      amount,
      paymentIntentId: paymentIntent.id,
      pixCode:         qrData?.data        || '',
      pixQrCode:       qrData?.image_url_png || '',
      expiresAt,
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    pixCode:         qrData?.data,
    pixQrCode:       qrData?.image_url_png,
    expiresAt,
    amount,
  };
}

module.exports = {
  stripe,
  createSetupIntent,
  savePaymentMethod,
  removePaymentMethod,
  chargeRide,
  retryRidePayment,
  createPixPayment,
};
