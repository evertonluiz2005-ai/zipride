-- Refresh tokens para autenticação segura
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id"        TEXT PRIMARY KEY,
  "token"     TEXT NOT NULL UNIQUE,
  "userId"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- FCM token para push notifications
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;
