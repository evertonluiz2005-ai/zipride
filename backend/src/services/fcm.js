// Firebase Cloud Messaging — envio de push notifications via Firebase Admin SDK
// Requer variáveis de ambiente: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

let messaging = null;

function init() {
  if (messaging) return;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('⚠️  Firebase não configurado — push notifications desativadas');
    return;
  }
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    messaging = admin.messaging();
    console.log('🔔 Firebase FCM configurado');
  } catch (err) {
    console.error('❌ Erro ao inicializar Firebase:', err.message);
  }
}

async function send(fcmToken, { title, body, data = {} }) {
  if (!messaging || !fcmToken) return;
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    // Token inválido ou expirado — não é erro crítico
    if (err.code !== 'messaging/registration-token-not-registered') {
      console.error('[FCM] Erro ao enviar notificação:', err.message);
    }
  }
}

module.exports = { init, send };
