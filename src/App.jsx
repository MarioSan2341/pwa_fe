import { useEffect, useState } from "react";
import Login from "./Login";
import Register from "./Register";
import Splash from "./Splash";

// ========================
// IndexedDB: openDB()
// ========================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("local-db", 2);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Crear tabla catalogs si no existe
      if (!db.objectStoreNames.contains("catalogs")) {
        db.createObjectStore("catalogs", { keyPath: "id" });
        console.log("📦 Store 'catalogs' creada");
      }

      // Crear tabla table si no existe (tu prueba)
      if (!db.objectStoreNames.contains("table")) {
        db.createObjectStore("table", { keyPath: "id", autoIncrement: true });
        console.log("📦 Store 'table' creada");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (err) => reject(err);
  });
}

// ========================
// Conversión VAPID
// ========================
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function App() {
  // ========================
  // Estados
  // ========================
  const [user, setUser] = useState(() => localStorage.getItem("user") || null);
  const [showRegister, setShowRegister] = useState(false);
  const [loadingSplash, setLoadingSplash] = useState(true);
  const [catalogs, setCatalogs] = useState([]);

  // ========================
  // Splash Screen
  // ========================
  useEffect(() => {
    const timer = setTimeout(() => setLoadingSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // ========================
  // Logout
  // ========================
  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  // ========================
  // Catálogos BASE
  // ========================
  const catalogsData = [
    { id: 1, name: "Electrónica", description: "Teléfonos, computadoras y más" },
    { id: 2, name: "Ropa", description: "Moda y accesorios" },
    { id: 3, name: "Libros", description: "Lectura y aprendizaje" },
    { id: 4, name: "Juguetes", description: "Diversión para todas las edades" }
  ];

  // ========================
  // Guardar catálogos en IndexedDB (solo online)
  // ========================
  useEffect(() => {
    async function saveCatalogs() {
      if (!navigator.onLine) return;
      const db = await openDB();
      const tx = db.transaction("catalogs", "readwrite");
      const store = tx.objectStore("catalogs");
      catalogsData.forEach((cat) => store.put(cat));
      console.log("📦 Catálogos guardados en IndexedDB");
    }
    saveCatalogs();
  }, []);

  // ========================
  // Cargar catálogos DESDE IndexedDB
  // ========================
  useEffect(() => {
    async function loadCatalogs() {
      const db = await openDB();
      const tx = db.transaction("catalogs", "readonly");
      const store = tx.objectStore("catalogs");
      const request = store.getAll();

      request.onsuccess = () => {
        if (request.result.length > 0) {
          setCatalogs(request.result);
          console.log("📂 Catálogos cargados desde IndexedDB:", request.result);
        } else {
          setCatalogs(catalogsData); // fallback
        }
      };
    }
    loadCatalogs();
  }, []);

  // ========================
  // Función para activar notificaciones PUSH
  // ========================
  async function activatePush() {
  const perm = await Notification.requestPermission();

  if (perm !== "granted") {
    alert("Debes permitir las notificaciones");
    return;
  }

  // Obtener el service worker registrado
  const reg = await navigator.serviceWorker.ready;

  // 🔹 Revisar si ya existe una suscripción
  const existingSub = await reg.pushManager.getSubscription();
  if (existingSub) {
    await existingSub.unsubscribe(); // eliminar suscripción antigua
    console.log("🗑 Suscripción antigua eliminada");
  }

  // Crear nueva suscripción con la VAPID correcta
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      "BErGkEWe6YOTAyjxwQfJ9aqT02_y9FZY0WgtWkiUO-2c8kmI3TSIEI2VbugzSNKTfPgl0CkfzyK5D3HregqzWk4"
    ),
  });

  // Enviar suscripción al backend
  await fetch("https://pwa-be-3xz0.onrender.com/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  alert("Notificaciones activadas 🎉");
}




  // ========================
  // Test IndexedDB
  // ========================
  const prueba = () => {
    const request = indexedDB.open("local-db", 2);
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction("table", "readwrite");
      const store = tx.objectStore("table");

      const addReq = store.add({ nombre: "masan", fecha: new Date() });
      addReq.onsuccess = () => console.log("✅ Registro agregado");
      addReq.onerror = (err) => console.error("❌ Error:", err);
    };
  };

  // ========================
// Enviar notificación de prueba
// ========================
async function sendTestNotification() {
  try {
    const res = await fetch("https://pwa-be-3xz0.onrender.com/sendNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "BUENISIMOOOO FUNCIONO uWu",
        message: "notifiacion de prueba sisisi",
        username: user // enviamos el usuario actual
      })
    });

    const data = await res.json();
    console.log("📨 Notificación enviada:", data);
    alert("Notificación de prueba enviada 🎉");
  } catch (err) {
    console.error("❌ Error enviando notificación:", err);
    alert("Error al enviar la notificación");
  }
}

async function sendNotification(message) {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return;

  const reg = await navigator.serviceWorker.ready;

  const options = {
    body: message,
    icon: "/icons/icon-192x192.png",
    data: { url: "/" }, // opcional: abrirá home al hacer clic
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200]
  };

  reg.showNotification("Carrito de compras 🛒", options);
}



  // ========================
  // Mostrar Splash
  // ========================
  if (loadingSplash) return <Splash />;

  // ========================
  // Login
  // ========================
  if (!user) {
    return showRegister ? (
      <Register />
    ) : (
      <Login
        onLogin={(u) => {
          localStorage.setItem("user", u);
          setUser(u);
        }}
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }

  // ========================
  // Página principal
  // ========================
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Bienvenido, {user}</h1>

      <h2 className="text-xl font-semibold mb-4 text-center">Elige un catálogo</h2>

      {/* Catálogos dinámicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {catalogs.map((cat) => (
  <div
    key={cat.id}
    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer"
    onClick={() => {
      alert(`Seleccionaste el catálogo: ${cat.name}`);
      sendNotification(`Este artículo "${cat.name}" se ha agregado al carrito`);
    }}
  >
    <h3 className="text-lg font-bold mb-2">{cat.name}</h3>
    <p className="text-gray-600">{cat.description}</p>
  </div>
))}

      </div>

      {/* Botón activar notificaciones */}
      <button
        onClick={activatePush}
        className="mt-8 bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-600 transition"
      >
        🔔 Activar Notificaciones
      </button>

      {/* Botón probar DB */}
      <button
        className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
        onClick={prueba}
      >
        Probar IndexedDB
      </button>

      {/* Logout */}
      <button
        className="mt-4 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition"
        onClick={logout}
      >
        Cerrar sesión
      </button>
      {/* Botón enviar notificación de prueba */}
<button
  onClick={sendTestNotification}
  className="mt-4 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition"
>
  📨 Enviar Notificación de Prueba
</button>
    </div>
  );
}

export default App;
