import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

let app       = null;
let messaging = null;

function isConfigured() {
  return !!process.env.REACT_APP_FIREBASE_API_KEY;
}

function getMessagingInstance() {
  if (!isConfigured()) return null;
  if (!app)       app       = initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

// Solicita permissão e retorna o FCM token do dispositivo
export async function requestFcmToken() {
  if (!isConfigured()) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const m = getMessagingInstance();
    const token = await getToken(m, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });
    return token || null;
  } catch {
    return null;
  }
}

// Listener para notificações recebidas com o app aberto
export function onForegroundMessage(callback) {
  if (!isConfigured()) return () => {};
  const m = getMessagingInstance();
  return onMessage(m, callback);
}
