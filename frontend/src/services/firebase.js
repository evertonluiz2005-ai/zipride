// Serviço unificado de push notifications.
// No browser usa Firebase Web SDK; no app Android/iOS usa Capacitor nativo.
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ─── Detecção de ambiente ─────────────────────────────────────────────────────
function isNativePlatform() {
  try { return !!(window.Capacitor?.isNativePlatform?.()); }
  catch { return false; }
}

// ─── Nativo: Capacitor Push Notifications (Android / iOS) ────────────────────
async function requestNativeToken() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration',      (t) => resolve(t.value));
      PushNotifications.addListener('registrationError', ()  => resolve(null));
    });
  } catch {
    return null;
  }
}

function listenNativeForeground(callback) {
  import('@capacitor/push-notifications').then(({ PushNotifications }) => {
    PushNotifications.addListener('pushNotificationReceived', (n) => {
      callback({ notification: { title: n.title, body: n.body } });
    });
  }).catch(() => {});
  return () => {};
}

// ─── Web: Firebase Messaging ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

let firebaseApp = null;
let messaging   = null;

function isWebConfigured() {
  return !!process.env.REACT_APP_FIREBASE_API_KEY;
}

function getWebMessaging() {
  if (!isWebConfigured()) return null;
  if (!firebaseApp) firebaseApp = initializeApp(firebaseConfig);
  if (!messaging)   messaging   = getMessaging(firebaseApp);
  return messaging;
}

async function requestWebToken() {
  if (!isWebConfigured()) return null;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;
    const m = getWebMessaging();
    return await getToken(m, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    }) || null;
  } catch {
    return null;
  }
}

function listenWebForeground(callback) {
  if (!isWebConfigured()) return () => {};
  const m = getWebMessaging();
  if (!m) return () => {};
  return onMessage(m, callback);
}

// ─── Exports unificados ───────────────────────────────────────────────────────
export async function requestFcmToken() {
  return isNativePlatform() ? requestNativeToken() : requestWebToken();
}

export function onForegroundMessage(callback) {
  return isNativePlatform() ? listenNativeForeground(callback) : listenWebForeground(callback);
}
