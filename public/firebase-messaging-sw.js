/* eslint-disable no-undef */

// ─── Offline fallback ───
const CACHE_NAME = "offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192x192.png"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

// ─── Firebase Cloud Messaging ───
importScripts("https://www.gstatic.com/firebasejs/11.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCRZqyROJXSAYct8qDPTw2tyO9D7bfP2lQ",
  authDomain: "days-count-aus.firebaseapp.com",
  projectId: "days-count-aus",
  storageBucket: "days-count-aus.firebasestorage.app",
  messagingSenderId: "457409155401",
  appId: "1:457409155401:web:b1281bb1e98e9944130a98",
});

// Use raw push event for full control over notification display
self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {};
  const d = payload.data || {};

  // If no data, let Firebase SDK handle it
  if (!d.title) return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if any app window is focused/visible
      const isAppOpen = windowClients.some(
        (c) => c.visibilityState === "visible" || c.focused
      );

      // App is open — in-app toast handles it, skip OS notification
      if (isAppOpen) return;

      // App is closed — show OS notification
      const title = d.title || "Days Count in AUS";
      const link = d.link || "/home";
      return self.registration.showNotification(title, {
        body: d.body || "",
        icon: d.icon || "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        data: { link },
      });
    })
  );
});

// Handle notification click — navigate to the link
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/home";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    })
  );
});
