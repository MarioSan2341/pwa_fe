import { useEffect, useState } from "react";
import Login from "./Login";
import Register from "./Register";
import Splash from "./Splash";
import Carrito from "./Carrito";

// ========================
// IndexedDB openDB()
// ========================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("local-db", 3);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("catalogs")) {
        db.createObjectStore("catalogs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("table")) {
        db.createObjectStore("table", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cart")) {
        db.createObjectStore("cart", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

// ========================
// util VAPID
// ========================
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function App() {
  // Estados
  const [user, setUser] = useState(() => localStorage.getItem("user") || null);
  const [showRegister, setShowRegister] = useState(false);
  const [loadingSplash, setLoadingSplash] = useState(true);

  const [catalogs, setCatalogs] = useState([]);
  const [cartItems, setCartItems] = useState([]); // items reales
  const [cartCount, setCartCount] = useState(0);
  const [viewCart, setViewCart] = useState(false);

  // Splash
  useEffect(() => {
    const t = setTimeout(() => setLoadingSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

 useEffect(() => {
  if (user) {
    loadCartFromDB();   // 🔥 RECARGA el carrito del nuevo usuario
  } else {
    setCartCount(0);    // 🔥 Cierra sesión → carrito vacío
  }
}, [user]);



  // Datos base de catálogos
  const catalogsData = [
    { id: 1, name: "Electrónica", description: "Teléfonos, computadoras y más" },
    { id: 2, name: "Ropa", description: "Moda y accesorios" },
    { id: 3, name: "Libros", description: "Lectura y aprendizaje" },
    { id: 4, name: "Juguetes", description: "Diversión para todas las edades" }
  ];

  // guardar catálogos (cuando haya internet)
  useEffect(() => {
    async function saveCatalogs() {
      if (!navigator.onLine) return;
      const db = await openDB();
      const tx = db.transaction("catalogs", "readwrite");
      const store = tx.objectStore("catalogs");
      catalogsData.forEach(cat => store.put(cat));
      // luego cargar
      loadCatalogs();
    }
    saveCatalogs();
  }, []);

  // cargar catálogos desde IndexedDB
  async function loadCatalogs() {
    try {
      const db = await openDB();
      const tx = db.transaction("catalogs", "readonly");
      const store = tx.objectStore("catalogs");
      const r = store.getAll();
      r.onsuccess = () => {
        const res = r.result || [];
        // si está vacío uso fallback
        setCatalogs(res.length ? res : catalogsData);
      };
      r.onerror = () => setCatalogs(catalogsData);
    } catch (err) {
      setCatalogs(catalogsData);
      console.error("loadCatalogs:", err);
    }
  }
  useEffect(() => { loadCatalogs(); }, []);

  // cargar carrito desde IndexedDB al iniciar
  async function loadCartFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction("cart", "readonly");
    const store = tx.objectStore("cart");
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const filtered = all.filter(i => i.username === user); // 🔥
      setCartItems(filtered);
      setCartCount(filtered.length); // 🔥
    };

  } catch (err) {
    console.error("Error abrir DB carrito:", err);
  }
}

  useEffect(() => { loadCartFromDB(); }, []);

  // notificación local
  async function sendLocalNotification(message) {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("Carrito 🛒", { body: message, icon: "/icons/icon-192x192.png" });
    } catch (e) {
      console.warn("No se pudo mostrar notificación local:", e);
    }
  }

  // agregar a carrito (offline-first)
  async function addToCart(product) {
    try {
      const db = await openDB();
      const tx = db.transaction("cart", "readwrite");
      const store = tx.objectStore("cart");
      const item = { 
  product, 
  username: user,     
  synced: navigator.onLine, 
  date: new Date().toISOString() 
};
      const addReq = store.add(item);
      addReq.onsuccess = (evt) => {
        // read id assigned by IDB
        const id = evt.target.result;
        // actualizar estado local con item completo (incluye id)
        setCartItems(prev => {
          const newItem = { id, ...item };
          setCartCount(prev.length ? prev.length + 1 : prev.length + 1);
          return [...prev, newItem];
        });
      };
      addReq.onerror = (err) => console.error("Error guardando en cart:", err);

      // notificación
      sendLocalNotification(`"${product.name}" agregado al carrito`);

      // si hay conexión, intenta sincronizar (función opcional en tu backend)
      if (navigator.onLine) {
        try { await syncCartWithServer(); } catch {}
      }
    } catch (err) {
      console.error("addToCart error:", err);
    }
  }

  // sincronizar pendientes con backend (tu endpoint /cartSync)
  async function syncCartWithServer() {
    const db = await openDB();
    const tx = db.transaction("cart", "readwrite");
    const store = tx.objectStore("cart");
    const allReq = store.getAll();
    return new Promise((resolve) => {
      allReq.onsuccess = async () => {
        const items = allReq.result || [];
        const pending = items.filter(i => !i.synced);
        if (pending.length === 0) return resolve();
        try {
          const res = await fetch("https://pwa-be-3xz0.onrender.com/cartSync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pending),
          });
          if (!res.ok) throw new Error("sync failed");
          // marcar sincronizados
          pending.forEach(p => {
            // buscar y actualizar
            p.synced = true;
            store.put(p);
          });
          console.log("Carrito sincronizado");
          resolve();
        } catch (e) {
          console.warn("Error sincronizando carrito:", e);
          resolve();
        }
      };
      allReq.onerror = () => resolve();
    });
  }

  // escuchar online para sincronizar automáticamente
  useEffect(() => {
    const onOnline = () => syncCartWithServer();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // activar push (mantengo tu lógica)
  async function activatePush() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { alert("Debes permitir notificaciones"); return; }
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) try { await existing.unsubscribe(); } catch (e) {}
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array("BErGkEWe6YOTAyjxwQfJ9aqT02_y9FZY0WgtWkiUO-2c8kmI3TSIEI2VbugzSNKTfPgl0CkfzyK5D3HregqzWk4"),
    });
    await fetch("https://pwa-be-3xz0.onrender.com/subscribe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: localStorage.getItem("user"), subscription })
});
    alert("Notificaciones activadas 🎉");
  }

  // enviar notificación de prueba (servidor)
  async function sendTestNotification() {
    try {
      const res = await fetch("https://pwa-be-3xz0.onrender.com/sendNotification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Notificación de prueba", message: "Todo OK", username: user })
      });
      const data = await res.json();
      console.log("📨", data);
      alert("Notificación enviada");
    } catch (e) {
      console.error(e);
      alert("Error enviando notificación");
    }
  }

  // logout (mantener)
  const logout = () => { localStorage.removeItem("user"); setUser(null); };

  // UI: si no logueado
  if (loadingSplash) return <Splash />;
  if (!user) {
    return showRegister ? <Register /> : <Login onLogin={(u) => { localStorage.setItem("user", u); setUser(u); }} onShowRegister={() => setShowRegister(true)} />;
  }

  // Si viewCart true mostramos la pantalla Carrito
  if (viewCart) {
    return (
  <Carrito
    user={user}
    onBack={() => { setViewCart(false); loadCartFromDB(); }}
    onClear={() => { setCartItems([]); setCartCount(0); }}
  />
);
  }

  // Render principal
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* carrito fijo */}
      <div className="fixed top-4 right-4 text-2xl z-50 cursor-pointer" onClick={() => setViewCart(true)}>
        🛒 <span className="text-sm bg-green-600 text-white px-2 py-1 rounded-full ml-1">{cartCount}</span>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center">Bienvenido, {user}</h1>
      <h2 className="text-xl font-semibold mb-4 text-center">Elige un catálogo</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {catalogs.map(cat => (
          <div key={cat.id} className="bg-white p-6 rounded-xl shadow relative">
            <h3 className="text-lg font-bold mb-2">{cat.name}</h3>
            <p className="text-gray-600 mb-4">{cat.description}</p>
            <button onClick={() => addToCart(cat)} className="absolute top-3 right-3 bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl hover:bg-green-700">+</button>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <button onClick={activatePush} className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-600 block">🔔 Activar Notificaciones</button>
        <button onClick={sendTestNotification} className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 block">📨 Enviar Notificación de Prueba</button>
        <button onClick={logout} className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 block">Cerrar sesión</button>
      </div>
    </div>
  );
}

export default App;
