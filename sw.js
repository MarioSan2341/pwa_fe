const APP_SHELL = "appShell_v3";
const DYNAMIC_CACHE = "dynamic_v1.0";

// Archivos del App Shell (producción)
const APP_SHELL_FILES = [
  "/",                     // index.html
  "/index.html",
  "/favicon.ico",
  "/manifest.json",
  "/assets/index.js",      // JS generado por Vite en dist/assets
  "/assets/index.css",     // CSS generado por Vite en dist/assets
  "/assets/App.css",       // Si tienes CSS adicional compilado
  "/assets/App.js",        // Opcional, si tienes bundles separados
  "/assets/Login.js",      // Opcional, si tienes bundles separados
  "/assets/Register.js",   // Opcional, si tienes bundles separados
  // Agrega aquí otros archivos estáticos necesarios
];
// Instalación y cache inicial
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando Service Worker...");
  event.waitUntil(
    caches.open(APP_SHELL).then(async (cache) => {
      for (const file of APP_SHELL_FILES) {
        try {
          await cache.add(file);
          console.log("[SW] Cacheado App Shell:", file);
        } catch (err) {
          console.warn("[SW] No se pudo cachear:", file, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de caches antiguas
self.addEventListener("activate", (event) => {
  console.log("[SW] Activando Service Worker...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log("[SW] Eliminando cache antigua:", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// Interceptar fetch y manejar cache dinámico
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Solo GET y mismo origen
  if (
    event.request.method === "GET" &&
    url.startsWith("http") &&
    url.includes(self.location.origin)
  ) {
    console.log("[SW] Fetch request:", url);

    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log("[SW] Recurso en cache:", url);
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            console.log("[SW] Recurso obtenido de la red:", url);
            caches.open(DYNAMIC_CACHE).then((cache) => {
              console.log("[SW] Guardando en cache dinámico:", url);
              cache.put(event.request, response.clone());
            });
            return response;
          })
          .catch(() => {
            console.log("[SW] Error fetch offline:", url);
            return new Response(
              "<h1>Offline: No se pudo cargar la página</h1>",
              { headers: { "Content-Type": "text/html" } }
            );
          });
      })
    );
  }
});
