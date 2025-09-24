import { useState } from "react";
import Login from "./Login";
import Register from "./Register";

function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  if (!user) {
    return showRegister ? (
      <Register />
    ) : (
      <Login onLogin={setUser} onShowRegister={() => setShowRegister(true)} />
    );
  }

  // Menú de catálogos
  const catalogs = [
    { id: 1, name: "Electrónica", description: "Teléfonos, computadoras y más" },
    { id: 2, name: "Ropa", description: "Moda y accesorios" },
    { id: 3, name: "Libros", description: "Lectura y aprendizaje" },
    { id: 4, name: "Juguetes", description: "Diversión para todas las edades" }
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Bienvenido, {user}
      </h1>

      <h2 className="text-xl font-semibold mb-4 text-center">
        Elige un catálogo
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {catalogs.map((cat) => (
          <div
            key={cat.id}
            className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer"
            onClick={() => alert(`Seleccionaste el catálogo: ${cat.name}`)}
          >
            <h3 className="text-lg font-bold mb-2">{cat.name}</h3>
            <p className="text-gray-600">{cat.description}</p>
          </div>
        ))}
      </div>

      <button
        className="mt-8 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition"
        onClick={() => setUser(null)}
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export default App;
