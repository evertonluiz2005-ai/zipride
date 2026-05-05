-- Migração: adicionar campos Stripe ao banco existente
-- Execute se já tiver o banco criado anteriormente sem esses campos

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "stripePaymentMethodId" TEXT,
  ADD COLUMN IF NOT EXISTS "cardBrand"             TEXT,
  ADD COLUMN IF NOT EXISTS "cardLast4"             TEXT,
  ADD COLUMN IF NOT EXISTS "cardExpMonth"          INTEGER,
  ADD COLUMN IF NOT EXISTS "cardExpYear"           INTEGER;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS "paymentStatus"    TEXT,
  ADD COLUMN IF NOT EXISTS "paymentIntentId"  TEXT,
  ADD COLUMN IF NOT EXISTS "paymentError"     TEXT;
