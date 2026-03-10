import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics: browser-only init (SSR would throw)
export const analytics = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);

// Messaging: browser-only
let messaging: Messaging | null = null;
export function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch {
      console.warn("Firebase Messaging not supported");
    }
  }
  return messaging;
}

export async function requestFCMToken(): Promise<string | null> {
  const m = getMessagingInstance();
  if (!m) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // Register service worker manually before requesting token
    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const token = await getToken(m, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });
    return token;
  } catch (e) {
    console.error("FCM token error:", e);
    return null;
  }
}

export function onFCMMessage(callback: (payload: unknown) => void) {
  const m = getMessagingInstance();
  if (!m) return () => {};
  return onMessage(m, callback);
}

export default app;
