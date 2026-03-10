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

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Days Count in AUS";
  const options = {
    body: payload.notification?.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
  };
  self.registration.showNotification(title, options);
});
