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
  const req = event.request;

  // ❌ EVITAR cachear cosas como chrome-extension://
  if (req.url.startsWith("chrome-extension://")) {
    return; // no intentar manejar esta petición
  }

  // Solo manejar GET
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((response) => {
          // Evitar cachear respuestas inválidas
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseClone = response.clone();

          caches.open("dynamic-cache-v1").then((cache) => {
            cache.put(req, responseClone).catch((err) => {
              console.warn("⚠️ Error cache.put:", err);
            });
          });

          return response;
        })
        .catch(() => {
          // fallback para navegación
          if (req.mode === "navigate") {
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
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
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
