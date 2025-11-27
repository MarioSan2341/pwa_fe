import { useEffect, useState } from "react";

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("local-db", 3);

    r.onupgradeneeded = () => {
      const db = r.result;

      if (!db.objectStoreNames.contains("cart")) {
        db.createObjectStore("cart", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("pendingBuys")) {
        db.createObjectStore("pendingBuys", { keyPath: "id", autoIncrement: true });
      }
    };

    r.onsuccess = () => resolve(r.result);
    r.onerror = (e) => reject(e);
  });
}

export default function Carrito({ user, onBack, onClear }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    load();
    syncPendingPurchases();

    window.addEventListener("online", syncPendingPurchases);
    return () => window.removeEventListener("online", syncPendingPurchases);
  }, []);

  // --------------------------------------------------------
  // 🔹 Cargar carrito filtrado por usuario
  // --------------------------------------------------------
  async function load() {
    try {
      const db = await openDB();
      const tx = db.transaction("cart", "readonly");
      const store = tx.objectStore("cart");

      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const filtered = all.filter(i => i.username === user);
        setItems(filtered);
      };
    } catch (e) {
      console.error("Error load carrito:", e);
    }
  }

  // --------------------------------------------------------
  // 🔹 Eliminar un ítem
  // --------------------------------------------------------
  async function removeItem(id) {
    const db = await openDB();
    const tx = db.transaction("cart", "readwrite");
    tx.objectStore("cart").delete(id);
    tx.oncomplete = () => load();
  }

  // --------------------------------------------------------
  // 🔹 Vaciar carrito
  // --------------------------------------------------------
  async function clearCart() {
    const db = await openDB();
    const tx = db.transaction("cart", "readwrite");
    tx.objectStore("cart").clear();
    tx.oncomplete = () => {
      setItems([]);
      if (onClear) onClear();
    };
  }

  // --------------------------------------------------------
  // 🔹 Comprar (online + offline)
  // --------------------------------------------------------
  async function handleBuy() {
    if (items.length === 0) return;

    const purchase = {
      username: user,
      items: items,
      date: new Date().toISOString()
    };

    // ---- ONLINE ----
    if (navigator.onLine) {
      try {
        const res = await fetch("https://pwa-be-3xz0.onrender.com/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(purchase),
        });

        const data = await res.json();
        if (data.success) {
          alert("Compra realizada con éxito");
          clearCart();
          return;
        }
      } catch {}
    }

    // ---- OFFLINE ----
    console.log("Sin internet → guardando compra offline");
    const db = await openDB();
    await db.transaction("pendingBuys", "readwrite")
            .objectStore("pendingBuys")
            .add(purchase);

    alert("No hay conexión. Compra guardada para sincronizar.");
    clearCart();
  }

  // --------------------------------------------------------
  // 🔹 Sincronización automática
  // --------------------------------------------------------
  async function syncPendingPurchases() {
    if (!navigator.onLine) return;

    console.log("Intentando sincronizar compras pendientes…");

    const db = await openDB();

    // 1️⃣ Obtener pendientes (transacción separada)
    const pending = await new Promise(resolve => {
      const tx = db.transaction("pendingBuys", "readonly");
      const req = tx.objectStore("pendingBuys").getAll();
      req.onsuccess = () => resolve(req.result || []);
    });

    if (!pending.length) return;

    console.log("🔄 Compras por sincronizar:", pending);

    for (const p of pending) {
      try {
        const res = await fetch("https://pwa-be-3xz0.onrender.com/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });

        const data = await res.json();

        if (data.success) {
          // 2️⃣ Eliminar compra sincronizada usando una nueva transacción
          await new Promise(resolve => {
            const delTx = db.transaction("pendingBuys", "readwrite");
            delTx.objectStore("pendingBuys").delete(p.id);
            delTx.oncomplete = resolve;
          });
        }

      } catch (err) {
        console.error("Error sincronizando compra:", err);
      }
    }

    console.log("✔ Sincronización finalizada");
  }

  // --------------------------------------------------------
  // 🔹 UI
  // --------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <button onClick={onBack} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">
        ⬅ Volver
      </button>

      <h1 className="text-3xl font-bold mb-4">🛒 Mi Carrito</h1>

      {items.length === 0 ? (
        <p className="text-gray-600">Tu carrito está vacío.</p>
      ) : (
        <>
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                <div>
                  <p className="font-semibold">{item.product.name}</p>
                  <p className="text-sm text-gray-500">{item.product.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">
                    {new Date(item.date).toLocaleString()}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-2 bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleBuy}
            className="mt-6 w-full bg-green-600 text-white py-2 rounded text-lg"
          >
            💳 Comprar
          </button>

          <button
            onClick={clearCart}
            className="mt-3 w-full bg-red-700 text-white py-2 rounded"
          >
            🗑 Vaciar carrito
          </button>
        </>
      )}
    </div>
  );
}
