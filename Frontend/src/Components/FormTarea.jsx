// src/Components/FormTarea.jsx
import React, { useState } from "react";
import api from "../api/axios";

export default function FormTarea({ cursoId, grupoId, onCreated }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaLimite, setFechaLimite] = useState(""); // datetime-local
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!titulo.trim() || !descripcion.trim() || !fechaLimite) {
      setError("Título, descripción y fecha límite son obligatorios.");
      return;
    }

    try {
      setLoading(true);

      // datetime-local → ISO
      const iso = new Date(fechaLimite).toISOString();

      const res = await api.post("/api/tareas", {
        titulo,
        descripcion,
        fechaLimite: iso,
        cursoId,
        grupoId,
      });

      const nueva = res.data;
      if (typeof onCreated === "function") {
        onCreated(nueva);
      }

      setTitulo("");
      setDescripcion("");
      setFechaLimite("");
    } catch (err) {
      console.error("Error creando tarea:", err.response?.data || err);
      setError(
        err.response?.data?.error || "No se pudo crear la tarea. Intenta otra vez."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h4>Crear nueva tarea</h4>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Título*{" "}
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              style={{ width: "100%" }}
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Descripción*{" "}
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              style={{ width: "100%", minHeight: "60px" }}
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Fecha límite*{" "}
            <input
              type="datetime-local"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              required
            />
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear tarea"}
        </button>
      </form>
    </div>
  );
}
