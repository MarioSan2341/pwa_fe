import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// -------------------------------
//  Registro del Service Worker
// -------------------------------
if ("serviceWorker" in navigator && "PushManager" in window) {
  navigator.serviceWorker
    .register("/sw.js")
    .then(async (registration) => {
      console.log("[SW] Service Worker registrado ✅");

      // Pedir permiso para notificaciones
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("🚫 Permiso de notificaciones denegado");
        return;
      }

      // Suscribirse al Push Manager
      const applicationServerKey = urlBase64ToUint8Array(
        "BISsmgTamq11wBHnruCtlQboxRoKqyLqjErVLsNzJk1phxiIOwopwDPTZ6knycS4zwNSblLzcZdpoLx9VZPFppo"
      );

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      console.log("✅ Subscripción obtenida:", subscription);

      // Enviar suscripción al backend
      await fetch("http://localhost:5000/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      console.log("📡 Subscripción enviada al servidor");
    })
    .catch((err) => console.error("❌ Error registrando el SW:", err));
}

// -------------------------------
//  IndexedDB para guardar POST offline
// -------------------------------
let dbRequest = window.indexedDB.open("pwaDatabase", 1);

dbRequest.onupgradeneeded = (event) => {
  const db = event.target.result;
  if (!db.objectStoreNames.contains("pendingPosts")) {
    db.createObjectStore("pendingPosts", { autoIncrement: true });
  }
};

dbRequest.onsuccess = () => {
  console.log("✅ IndexedDB inicializada correctamente");
};

dbRequest.onerror = (err) => {
  console.error("❌ Error al abrir IndexedDB:", err);
};

// -------------------------------
//  Render de React
// -------------------------------
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// -------------------------------
//  Función utilitaria para clave VAPID
// -------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
