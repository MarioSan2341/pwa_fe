import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// -------------------------------
// Registro estándar del Service Worker
// -------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("SW Registrado ✔"))
      .catch((err) => console.error("Error registrando SW:", err));
  });
}

// -------------------------------
// IndexedDB BASICO para la app
// -------------------------------
let dbRequest = window.indexedDB.open("pwaDatabase", 1);

dbRequest.onupgradeneeded = (event) => {
  const db = event.target.result;

  if (!db.objectStoreNames.contains("pendingPosts")) {
    db.createObjectStore("pendingPosts", { autoIncrement: true });
  }
};

dbRequest.onsuccess = () => console.log("IndexedDB lista ✔");
dbRequest.onerror = (err) => console.error("IndexedDB error ❌", err);

// -------------------------------
// React DOM Render
// -------------------------------
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
