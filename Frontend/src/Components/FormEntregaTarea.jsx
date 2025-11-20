// src/Components/FormEntregaTarea.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";

export default function FormEntregaTarea({ tarea, onSubmitted }) {
  const [comentario, setComentario] = useState("");
  const [enlace, setEnlace] = useState("");
  const [archivo, setArchivo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [miEntrega, setMiEntrega] = useState(null);

  // Cargar si ya entregó
  useEffect(() => {
    if (!tarea?.id) return;

    const cargarEntrega = async () => {
      try {
        const res = await api.get(
          `/api/tareas/${tarea.id}/mi-entrega`
        );
        setMiEntrega(res.data);
      } catch (err) {
        console.error("Error cargando mi entrega:", err.response?.data || err);
      }
    };

    cargarEntrega();
  }, [tarea?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!archivo && !enlace.trim()) {
      setError("Debes adjuntar un archivo o colocar un enlace.");
      return;
    }

    const formData = new FormData();
    formData.append("comentario", comentario);
    formData.append("enlace", enlace);
    if (archivo) {
      formData.append("archivo", archivo);
    }

    try {
      setLoading(true);
      const res = await api.post(
        `/api/tareas/${tarea.id}/entregas`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setMiEntrega(res.data);
      setComentario("");
      setEnlace("");
      setArchivo(null);

      if (onSubmitted) onSubmitted(res.data);
    } catch (err) {
      console.error("Error enviando entrega:", err.response?.data || err);
      setError(
        err.response?.data?.error ||
          "No se pudo enviar la entrega. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleArchivoChange = (e) => {
    const file = e.target.files[0];
    setArchivo(file || null);
  };

  const formatFecha = (ts) => {
    if (!ts) return "";
    try {
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
      if (ts._seconds || ts.seconds) {
        const s = ts._seconds ?? ts.seconds;
        return new Date(s * 1000).toLocaleString();
      }
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  };

  const ahora = new Date();
  const limite = tarea.fechaLimite
    ? new Date(
        typeof tarea.fechaLimite.toDate === "function"
          ? tarea.fechaLimite.toDate()
          : tarea.fechaLimite._seconds || tarea.fechaLimite.seconds
          ? (tarea.fechaLimite._seconds || tarea.fechaLimite.seconds) * 1000
          : tarea.fechaLimite
      )
    : null;

  const expirada = limite && ahora > limite;

  return (
    <div
      style={{
        borderTop: "1px solid #ddd",
        marginTop: "0.75rem",
        paddingTop: "0.75rem",
      }}
    >
      <h4>Entrega de la tarea</h4>

      {miEntrega && (
        <div
          style={{
            background: "#e6ffed",
            border: "1px solid #b7eb8f",
            padding: "0.5rem 0.75rem",
            borderRadius: 4,
            marginBottom: "0.5rem",
          }}
        >
          <strong>Ya enviaste esta tarea.</strong>{" "}
          <span>
            Fecha de envío: {formatFecha(miEntrega.createdAt)} – Estado:{" "}
            {miEntrega.estado || "entregada"}
          </span>
          {miEntrega.archivoUrl && (
            <div>
              Archivo:{" "}
              <a
                href={miEntrega.archivoUrl}
                target="_blank"
                rel="noreferrer"
              >
                {miEntrega.archivoNombre || "Ver archivo"}
              </a>
            </div>
          )}
          {miEntrega.enlace && (
            <div>
              Enlace:{" "}
              <a href={miEntrega.enlace} target="_blank" rel="noreferrer">
                {miEntrega.enlace}
              </a>
            </div>
          )}
        </div>
      )}

      {expirada && !miEntrega && (
        <p style={{ color: "red" }}>
          La fecha límite ya expiró, no puedes enviar esta tarea.
        </p>
      )}

      {!expirada && (
        <form onSubmit={handleSubmit}>
          {error && (
            <p style={{ color: "red", marginBottom: "0.5rem" }}>{error}</p>
          )}

          <div style={{ marginBottom: "0.5rem" }}>
            <label>
              Comentario (opcional):
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                style={{ width: "100%", minHeight: "60px" }}
              />
            </label>
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label>
              Archivo (máx. 10MB):
              <input type="file" onChange={handleArchivoChange} />
            </label>
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label>
              Enlace (opcional o en lugar de archivo):
              <input
                type="url"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
                placeholder="https://..."
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Enviando..." : miEntrega ? "Enviar otra vez" : "Entregar tarea"}
          </button>
        </form>
      )}
    </div>
  );
}
