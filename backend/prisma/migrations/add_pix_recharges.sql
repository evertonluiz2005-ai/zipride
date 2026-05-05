CREATE TABLE IF NOT EXISTS pix_recharges (
  id                TEXT        NOT NULL PRIMARY KEY,
  "userId"          TEXT        NOT NULL REFERENCES users(id),
  amount            DOUBLE PRECISION NOT NULL,
  "paymentIntentId" TEXT        NOT NULL UNIQUE,
  "pixCode"         TEXT        NOT NULL DEFAULT '',
  "pixQrCode"       TEXT        NOT NULL DEFAULT '',
  "expiresAt"       TIMESTAMPTZ NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pix_recharges_user_id_idx ON pix_recharges("userId");
