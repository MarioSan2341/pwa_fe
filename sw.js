const APP_SHELL = "appShell_v1";
const DYNAMIC_CACHE = "dynamic_v1.0";

// Rutas fijas del App Shell
const APP_SHELL_FILES = [
  "/index.html",
  "/index.css",
  "/src/App.jsx",
  "/src/App.css",
  "/favicon.ico",
  "/src/Login.jsx",
  "/src/Register.jsx",
  "/src/main.jsx",
];

// Instalación y cache inicial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting(); // activar inmediatamente
});

// Activación y limpieza de caches antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== APP_SHELL && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // tomar control inmediato de las páginas
});

// Interceptar fetch y manejar cache dinámico
self.addEventListener("fetch", (event) => {
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Si está en cache, retornar
          return cachedResponse;
        }
        // Sino, hacer fetch y agregar al cache dinámico
        return fetch(event.request)
          .then((response) => {
            return caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(event.request, response.clone());
              return response;
            });
          })
          .catch(() => {
            // Si falla el fetch (offline) y no está en cache
            return new Response(
              "<h1>Offline: No se pudo cargar la página</h1>",
              { headers: { "Content-Type": "text/html" } }
            );
          });
      })
    );
  }
});
