import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import app from "./firebase";

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
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
  if (typeof window === "undefined") return null;
  const m = getMessagingInstance();
  if (!m) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

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
  if (typeof window === "undefined") return () => {};
  const m = getMessagingInstance();
  if (!m) return () => {};
  return onMessage(m, callback);
}
