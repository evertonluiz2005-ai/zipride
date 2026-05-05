-- Tornar paymentIntentId opcional (recargas manuais não usam Stripe)
ALTER TABLE pix_recharges ALTER COLUMN "paymentIntentId" DROP NOT NULL;

-- Código de referência legível (PIX-XXXXXX)
ALTER TABLE pix_recharges ADD COLUMN IF NOT EXISTS reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pix_recharges_reference_unique
  ON pix_recharges(reference) WHERE reference IS NOT NULL;

-- Motivo de rejeição (preenchido pelo admin)
ALTER TABLE pix_recharges ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;
