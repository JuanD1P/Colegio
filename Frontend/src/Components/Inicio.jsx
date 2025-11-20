// src/Components/Inicio.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Inicio() {
  const [user, setUser] = useState(null);
  const [grupos, setGrupos] = useState([]); // grupos donde el alumno está matriculado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // 1) Leer usuario desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log("User estudiante localStorage:", parsed);
        setUser(parsed);
      } catch (e) {
        console.error("Error parseando user en Inicio.jsx", e);
      }
    }
  }, []);

  // 2) Cargar grupos del estudiante
  useEffect(() => {
    if (!user) return;

    const rol = (user.rol || "").toUpperCase();
    if (rol !== "ESTUDIANTE") return;

    const perfilCompleto = !!user.perfilCompleto;
    if (!perfilCompleto) return; // si no está completo, mostramos el mensaje de abajo

    const cargarGrupos = async () => {
      try {
        setLoading(true);
        setError("");
        console.log("GET /api/alumnos/:id/grupos con id =", user.id);

        const res = await api.get(`/api/alumnos/${user.id}/grupos`);
        console.log("Grupos del estudiante:", res.data);
        setGrupos(res.data || []);
      } catch (err) {
        console.error("Error cargando grupos alumno:", err.response?.data || err);
        setError(
          err.response?.data?.error || "No se pudieron cargar tus grupos."
        );
      } finally {
        setLoading(false);
      }
    };

    cargarGrupos();
  }, [user]);

  // ───────── Render ─────────

  if (!user) {
    return <p>Debes iniciar sesión.</p>;
  }

  const rol = (user.rol || "").toUpperCase();
  const perfilCompleto = !!user.perfilCompleto;

  // 👉 AQUÍ: si es estudiante y no tiene perfil completo, lo mandamos a /perfil
  if (rol === "ESTUDIANTE" && !perfilCompleto) {
    return (
      <div className="container">
        <h1>Hola, {user.nombre || "estudiante"}</h1>
        <p>Antes de ver tus grupos debes completar tu información personal.</p>
        <button onClick={() => navigate("/perfil")}>Completar perfil</button>
      </div>
    );
  }

  if (rol !== "ESTUDIANTE") {
    return <p>Esta página está diseñada para estudiantes.</p>;
  }

  return (
    <div className="container">
      <h1>Hola, {user.nombre || "estudiante"}</h1>
      <h2>Mis grupos / cursos</h2>

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
      )}

      {loading && <p>Cargando tus grupos...</p>}

      {!loading && grupos.length === 0 && !error && (
        <p>No estás matriculado en ningún grupo actualmente.</p>
      )}

      {!loading && grupos.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          {grupos.map((g) => (
            <div
              key={g.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
              }}
            >
              <h3>{g.cursoNombre || "Curso sin nombre"}</h3>
              <p>
                <strong>Grupo:</strong> {g.nombreGrupo || "Sin nombre"}
              </p>
              {g.profesorNombre && (
                <p>
                  <strong>Profesor:</strong> {g.profesorNombre}
                  {g.profesorEmail && ` (${g.profesorEmail})`}
                </p>
              )}

              <h4>Horario</h4>
              {Array.isArray(g.horario) && g.horario.length > 0 ? (
                <ul>
                  {g.horario.map((h, idx) => (
                    <li key={idx}>
                      Aula {h.aula || "N/D"} – Día {h.dia} – {h.inicio} a{" "}
                      {h.fin}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Este grupo no tiene horario registrado.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
