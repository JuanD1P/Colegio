// src/Components/FormMaterial.jsx
import React, { useState } from "react";
import api from "../api/axios";

export default function FormMaterial({ cursoId, grupoId, onUploaded }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enlace, setEnlace] = useState("");
  const [archivo, setArchivo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const handleFileChange = (e) => {
    setArchivo(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOkMsg("");

    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!archivo && !enlace.trim()) {
      setError("Debes adjuntar un archivo o colocar un enlace.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("titulo", titulo);
      formData.append("descripcion", descripcion);
      formData.append("cursoId", cursoId || "");
      formData.append("grupoId", grupoId || "");
      formData.append("enlace", enlace);
      if (archivo) {
        formData.append("archivo", archivo);
      }

      const res = await api.post("/api/materiales", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOkMsg("Material publicado correctamente ✅");
      setTitulo("");
      setDescripcion("");
      setEnlace("");
      setArchivo(null);

      // limpiar input file
      e.target.reset?.();

      if (onUploaded) onUploaded(res.data);
    } catch (err) {
      console.error("Error publicando material:", err.response?.data || err);
      setError(
        err.response?.data?.error || "No se pudo publicar el material."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h4>Publicar material</h4>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {okMsg && <p style={{ color: "green" }}>{okMsg}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        <div>
          <label>Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div>
          <label>Archivo</label>
          <input type="file" onChange={handleFileChange} />
        </div>

        <div>
          <label>Enlace (opcional o en lugar de archivo)</label>
          <input
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar material"}
        </button>
      </form>
    </div>
  );
}
