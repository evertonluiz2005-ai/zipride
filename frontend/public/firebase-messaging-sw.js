// Service Worker para receber notificações FCM em background
// Substitua os valores abaixo pelas configurações do seu projeto Firebase

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            self.FIREBASE_API_KEY            || '',
  authDomain:        self.FIREBASE_AUTH_DOMAIN        || '',
  projectId:         self.FIREBASE_PROJECT_ID         || '',
  storageBucket:     self.FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             self.FIREBASE_APP_ID             || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'ZipRide', {
    body:  body || '',
    icon:  '/logo192.png',
    badge: '/logo192.png',
    data:  payload.data,
  });
});
