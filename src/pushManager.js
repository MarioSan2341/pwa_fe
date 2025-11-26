function urlBase64ToUint8(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUser(username) {
  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8(
        "BErGkEWe6YOTAyjxwQfJ9aqT02_y9FZY0WgtWkiUO-2c8kmI3TSIEI2VbugzSNKTfPgl0CkfzyK5D3HregqzWk4"
      )
    });

    const res = await fetch("https://pwa-be-3xz0.onrender.com/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        subscription
      })
    });

    console.log("Respuesta de /subscribe:", await res.json());

  } catch (err) {
    console.error("❌ Error al suscribir usuario:", err);
  }
}
