import { useEffect, useState } from "react";

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("local-db", 3);
    r.onsuccess = () => resolve(r.result);
    r.onerror = (e) => reject(e);
  });
}

export default function Carrito({ onBack, onClear }) {
  const [items, setItems] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const db = await openDB();
      const tx = db.transaction("cart", "readonly");
      const store = tx.objectStore("cart");
      const req = store.getAll();
      req.onsuccess = () => setItems(req.result || []);
    } catch (e) {
      console.error("Error load carrito:", e);
    }
  }

  async function removeItem(id) {
    const db = await openDB();
    const tx = db.transaction("cart", "readwrite");
    tx.objectStore("cart").delete(id);
    tx.oncomplete = () => load();
  }

  async function clearCart() {
    const db = await openDB();
    const tx = db.transaction("cart", "readwrite");
    tx.objectStore("cart").clear();
    tx.oncomplete = () => { setItems([]); if (onClear) onClear(); };
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <button onClick={onBack} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">⬅ Volver</button>
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
                  <div className="text-xs text-gray-400">{new Date(item.date).toLocaleString()}</div>
                  <button onClick={() => removeItem(item.id)} className="mt-2 bg-red-500 text-white px-3 py-1 rounded">Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={clearCart} className="mt-6 w-full bg-red-700 text-white py-2 rounded">🗑 Vaciar carrito</button>
        </>
      )}
    </div>
  );
}
