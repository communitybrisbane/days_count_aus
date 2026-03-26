/* eslint-disable no-undef */
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

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async (payload) => {
  // Check if any app window is currently visible (foreground)
  const windowClients = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const hasVisibleClient = windowClients.some(
    (client) => client.visibilityState === "visible"
  );

  // If app is open, skip OS notification — in-app toast handles it
  if (hasVisibleClient) return;

  const d = payload.data || {};
  const title = d.title || "Days Count in AUS";
  const link = d.link || "/home";
  const options = {
    body: d.body || "",
    icon: d.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: { link },
  };
  self.registration.showNotification(title, options);
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
