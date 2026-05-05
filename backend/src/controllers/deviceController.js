const prisma          = require('../db');
const gpsSimulator    = require('../services/gpsSimulator');

const DEVICE_API_KEY = process.env.DEVICE_API_KEY || '123456';

const REQUIRED_FIELDS = ['device_id', 'lat', 'lng', 'battery', 'voltage', 'speed', 'locked', 'timestamp'];

// POST /api/device/update
async function updateDevice(req, res) {
  try {
    const body = req.body;

    if (body.api_key !== DEVICE_API_KEY) {
      return res.status(403).json({ error: 'Forbidden: api_key inválida' });
    }

    const missing = REQUIRED_FIELDS.filter(f => body[f] === undefined || body[f] === null);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios ausentes: ${missing.join(', ')}` });
    }

    const { device_id, lat, lng, battery, voltage, speed, locked, timestamp } = body;

    await prisma.deviceLog.create({
      data: { deviceId: device_id, lat, lng, battery, voltage, speed, locked, timestamp },
    });

    // Busca patinete pelo deviceId (IMEI do tracker)
    const scooter = await prisma.scooter.findFirst({ where: { deviceId: device_id } });
    if (scooter) {
      await prisma.scooter.update({
        where: { id: scooter.id },
        data: { lat, lng, battery, locked, lastUpdate: new Date() },
      });
      await gpsSimulator.refreshScooter(scooter.id);
    }

    console.log(
      `[IoT] ${new Date().toLocaleTimeString('pt-BR')} ` +
      `device=${device_id} bat=${battery}% volt=${voltage}V spd=${speed}km/h ` +
      `locked=${locked} lat=${lat.toFixed(5)} lng=${lng.toFixed(5)}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[IoT] Erro em updateDevice:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
}

// GET /api/device/:id  — últimos 10 registros
async function getDevice(req, res) {
  try {
    const logs = await prisma.deviceLog.findMany({
      where:   { deviceId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });
    res.json(logs);
  } catch (err) {
    console.error('[IoT] Erro em getDevice:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
}

// POST /api/device/command
async function sendCommand(req, res) {
  try {
    const { device_id, command } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id obrigatório' });
    }
    if (!['lock', 'unlock'].includes(command)) {
      return res.status(400).json({ error: 'command deve ser "lock" ou "unlock"' });
    }

    console.log(`[IoT] Comando → device=${device_id} command=${command}`);

    // Futuramente: publicar no tópico MQTT scooters/{device_id}/command
    // mqttClient.publish(`scooters/${device_id}/command`, JSON.stringify({ action: command }))

    res.json({ status: 'sent' });
  } catch (err) {
    console.error('[IoT] Erro em sendCommand:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
}

module.exports = { updateDevice, getDevice, sendCommand };
