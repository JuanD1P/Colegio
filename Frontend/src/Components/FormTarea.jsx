// src/Components/FormTarea.jsx
import React, { useState } from "react";
import api from "../api/axios";
import "./DOCSS/HomeProfe.css"; // para reutilizar los estilos del profe

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
        err.response?.data?.error ||
          "No se pudo crear la tarea. Intenta otra vez."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profe-formTarea" id="profe-formTarea">
      <h4 className="profe-subsectionTitle">Crear nueva tarea</h4>

      {error && <p className="profe-error">{error}</p>}

      <form onSubmit={handleSubmit} className="profe-formTareaForm">
        <label className="profe-formTareaField">
          <span>Título *</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </label>

        <label className="profe-formTareaField">
          <span>Descripción *</span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </label>

        <label className="profe-formTareaField">
          <span>Fecha límite *</span>
          <input
            type="datetime-local"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            required
          />
        </label>

        <div className="profe-formTareaActions">
          <button
            type="submit"
            className="profe-btn profe-btn--primary"
            disabled={loading}
          >
            {loading ? "Creando..." : "Crear tarea"}
          </button>
        </div>
      </form>
    </div>
  );
}
