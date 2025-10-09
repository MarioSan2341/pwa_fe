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

// -----------------------------
// IndexedDB Helper
// -----------------------------
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pwa-db", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pending-posts")) {
        db.createObjectStore("pending-posts", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePostRequest(data) {
  const db = await openDB();
  const tx = db.transaction("pending-posts", "readwrite");
  tx.objectStore("pending-posts").add(data);
  return tx.complete;
}

async function getPendingPosts() {
  const db = await openDB();
  const tx = db.transaction("pending-posts", "readonly");
  return tx.objectStore("pending-posts").getAll();
}

async function clearPost(id) {
  const db = await openDB();
  const tx = db.transaction("pending-posts", "readwrite");
  tx.objectStore("pending-posts").delete(id);
  return tx.complete;
}

// -----------------------------
// Interceptar POST fallidos
// -----------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method === "POST") {
    event.respondWith(
      fetch(req.clone()).catch(async () => {
        console.log("[SW] POST falló, guardando en IndexedDB...");
        const cloned = await req.clone().json().catch(() => null);
        if (cloned) {
          await savePostRequest({
            url: req.url,
            body: cloned,
            timestamp: Date.now(),
          });

          // Registrar la sincronización
          if (self.registration.sync) {
            await self.registration.sync.register("sync-posts");
            console.log("[SW] Background Sync registrado.");
          }
        }

        // Respuesta offline temporal
        return new Response(
          JSON.stringify({ message: "Sin conexión. Se guardó localmente." }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
  }
});

// -----------------------------
// Evento de sincronización
// -----------------------------
self.addEventListener("sync", async (event) => {
  if (event.tag === "sync-posts") {
    console.log("[SW] Intentando reenviar POST pendientes...");
    event.waitUntil(
      (async () => {
        const posts = await getPendingPosts();
        for (const post of posts) {
          try {
            const res = await fetch(post.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(post.body),
            });
            if (res.ok) {
              console.log("[SW] POST reenviado correctamente:", post.url);
              await clearPost(post.id);
            } else {
              console.warn("[SW] Error al reenviar:", post.url);
            }
          } catch (err) {
            console.error("[SW] No hay conexión todavía:", err);
          }
        }
      })()
    );
  }
});

