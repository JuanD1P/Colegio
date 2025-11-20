// src/Components/FormEntregaTarea.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";

export default function FormEntregaTarea({ tarea, miEntrega: miEntregaProp, onSubmitted }) {
  const [comentario, setComentario] = useState("");
  const [enlace, setEnlace] = useState("");
  const [archivo, setArchivo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [miEntrega, setMiEntrega] = useState(miEntregaProp || null);

  // si el padre nos manda miEntrega, la sincronizamos
  useEffect(() => {
    setMiEntrega(miEntregaProp || null);
  }, [miEntregaProp?.id]);

  // Si no viene miEntrega por props, la consultamos nosotros
  useEffect(() => {
    if (!tarea?.id || miEntregaProp) return;

    const cargarEntrega = async () => {
      try {
        const res = await api.get(`/api/tareas/${tarea.id}/mi-entrega`);
        setMiEntrega(res.data);
      } catch (err) {
        console.error("Error cargando mi entrega:", err.response?.data || err);
      }
    };

    cargarEntrega();
  }, [tarea?.id, miEntregaProp]);

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
    if (archivo) formData.append("archivo", archivo);

    try {
      setLoading(true);
      const res = await api.post(
        `/api/tareas/${tarea.id}/entregas`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
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
    <div className="estu-entrega">
      <h4 className="estu-entregaTitle">Entrega de la tarea</h4>

      {miEntrega && (
        <div className="estu-entregaBanner">
          <div className="estu-entregaBanner-main">
            <strong>Ya enviaste esta tarea.</strong>
            <span>
              Fecha de envío: {formatFecha(miEntrega.createdAt)} – Estado:{" "}
              {miEntrega.estado || "entregada"}
            </span>
          </div>

          {miEntrega.archivoUrl && (
            <div className="estu-entregaBanner-line">
              Archivo:&nbsp;
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
            <div className="estu-entregaBanner-line">
              Enlace:&nbsp;
              <a href={miEntrega.enlace} target="_blank" rel="noreferrer">
                {miEntrega.enlace}
              </a>
            </div>
          )}
        </div>
      )}

      {expirada && !miEntrega && (
        <p className="estu-entregaWarning">
          La fecha límite ya expiró, no puedes enviar esta tarea.
        </p>
      )}

      {!expirada && (
        <form className="estu-entregaForm" onSubmit={handleSubmit}>
          {error && <p className="estu-entregaError">{error}</p>}

          <label className="estu-label">
            <span>Comentario (opcional)</span>
            <textarea
              className="estu-textarea"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </label>

          <div className="estu-fileRow">
            <span className="estu-labelText">Archivo (máx. 10MB)</span>
            <div className="estu-fileInputWrapper">
              <input
                type="file"
                className="estu-fileInput"
                onChange={handleArchivoChange}
              />
              <div className="estu-fileFakeButton">Seleccionar archivo</div>
              <span className="estu-fileName">
                {archivo?.name || "Ningún archivo seleccionado"}
              </span>
            </div>
          </div>

          <label className="estu-label">
            <span>Enlace (opcional o en lugar de archivo)</span>
            <input
              type="url"
              className="estu-input"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="estu-entregaActions">
            <button
              type="submit"
              className="estu-btn estu-btn--primary"
              disabled={loading}
            >
              {loading
                ? "Enviando..."
                : miEntrega
                ? "Enviar otra vez"
                : "Entregar tarea"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
