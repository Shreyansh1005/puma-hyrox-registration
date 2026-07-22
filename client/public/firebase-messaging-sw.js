importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDbYJZ3wTl1RaOJJkWHepEP-u_i2zNx36I",
  authDomain: "puma-hyrox-app.firebaseapp.com",
  projectId: "puma-hyrox-app",
  storageBucket: "puma-hyrox-app.firebasestorage.app",
  messagingSenderId: "744193386246",
  appId: "1:744193386246:web:56259cd22bcd98c4d3a087"
});

const messaging = firebase.messaging();

// Handle notifications in the background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'PUMA X HYROX Pass';
  const notificationOptions = {
    body: payload.notification.body || 'Your registration is locked in!',
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});