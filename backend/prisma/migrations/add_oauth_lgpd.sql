-- Tornar password nullable (usuários OAuth não têm senha)
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Campos OAuth
ALTER TABLE users ADD COLUMN IF NOT EXISTS "oauthProvider" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "oauthId"       TEXT;

-- Aceite LGPD
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lgpdAcceptedAt" TIMESTAMPTZ;

-- Índice único para o par (provider, oauthId) quando ambos não nulos
CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_provider_id_unique
  ON users("oauthProvider", "oauthId")
  WHERE "oauthId" IS NOT NULL;
