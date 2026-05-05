-- Tabela de telemetria dos dispositivos ESP32
CREATE TABLE IF NOT EXISTS "devices_logs" (
  "id"        SERIAL PRIMARY KEY,
  "deviceId"  TEXT NOT NULL,
  "lat"       DOUBLE PRECISION NOT NULL,
  "lng"       DOUBLE PRECISION NOT NULL,
  "battery"   DOUBLE PRECISION NOT NULL,
  "voltage"   DOUBLE PRECISION NOT NULL,
  "speed"     DOUBLE PRECISION NOT NULL,
  "locked"    BOOLEAN NOT NULL,
  "timestamp" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "devices_logs_deviceId_idx" ON "devices_logs"("deviceId");
