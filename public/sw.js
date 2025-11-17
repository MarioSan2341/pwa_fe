// =======================
//        CONFIG
// =======================
const CACHE_NAME = "app-cache-v1";
const OFFLINE_URL = "/offline.html";

// Archivos estáticos a cachear
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// =======================
//  INSTALL
// =======================
self.addEventListener("install", (event) => {
  console.log("📦 Service Worker instalado");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// =======================
//  ACTIVATE
// =======================
self.addEventListener("activate", (event) => {
  console.log("⚡ Service Worker activado");

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// =======================
//  FETCH - OFFLINE
// =======================
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Clonar response y guardar en cache
          const responseClone = response.clone();
          caches.open("dynamic-cache-v1").then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // fallback para páginas HTML
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});



// =======================
//  PUSH NOTIFICATIONS
// =======================
self.addEventListener("push", (event) => {
  console.log("📩 Push recibido:", event.data?.text());

  let data = { title: "Notificación", body: "Tienes una nueva notificación" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      console.warn("⚠️ Push recibido no es JSON, usando fallback", err);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "Tienes una nueva notificación",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Notificación", options)
  );
});

// =======================
//  CLICK EN NOTIFICACIÓN
// =======================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clis) => {
      for (const client of clis) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
