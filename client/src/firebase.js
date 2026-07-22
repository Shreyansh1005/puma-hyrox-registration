import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDbYJZ3wTl1RaOJJkWHepEP-u_i2zNx36I",
  authDomain: "puma-hyrox-app.firebaseapp.com",
  projectId: "puma-hyrox-app",
  storageBucket: "puma-hyrox-app.firebasestorage.app",
  messagingSenderId: "744193386246",
  appId: "1:744193386246:web:56259cd22bcd98c4d3a087",
  measurementId: "G-9VKEYPGST3"
};

const app = initializeApp(firebaseConfig);

// Initialize messaging conditionally to avoid breaking on unsupported browsers/environments
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  return supported ? getMessaging(app) : null;
};

export const requestFcmToken = async () => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM Messaging is not supported in this browser environment.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      
      const token = await getToken(messaging, {
        // Replace this with your exact VAPID key copied from Firebase Console
        vapidKey: "BEkcubneCEsrd5R2_ir9V9R8euokGcXWxe_T4klARV910jz_IECu-WKcQfhd-_ziJfOy3qJ2Ho3Dca2tBlXa3xQ"
      });

      console.log("FCM Device Token generated successfully:", token);
      return token;
    } else {
      console.warn("Notification permission denied by user.");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};