// src/Components/Home.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";

export default function Home() {
  const [user, setUser] = useState(null);

  const [gruposProfe, setGruposProfe] = useState([]); // TODOS los grupos donde es profesor
  const [cursos, setCursos] = useState([]);           // cursos únicos derivados de esos grupos

  const [cursoSel, setCursoSel] = useState("");
  const [gruposFiltrados, setGruposFiltrados] = useState([]);
  const [grupoSel, setGrupoSel] = useState("");
  const [grupoActual, setGrupoActual] = useState(null);

  const [alumnos, setAlumnos] = useState([]);

  const [loadingGruposProfe, setLoadingGruposProfe] = useState(false);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [error, setError] = useState("");

  // 1) Leer user desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log("User desde localStorage:", parsed);
        setUser(parsed);
      } catch (e) {
        console.error("Error parseando usuario de localStorage", e);
      }
    }
  }, []);

  // 2) Cargar todos los grupos del profesor
  useEffect(() => {
    if (!user) return;
    const rol = (user.rol || "").toUpperCase();
    if (rol !== "PROFESOR") return;

    const cargarGruposProfe = async () => {
      try {
        setLoadingGruposProfe(true);
        setError("");
        console.log("GET /api/profesores/:id/grupos con id =", user.id);

        const res = await api.get(`/api/profesores/${user.id}/grupos`);
        const grupos = res.data || [];
        console.log("Grupos del profesor:", grupos);
        setGruposProfe(grupos);

        // Derivar cursos únicos desde esos grupos
        const mapCursos = new Map();
        grupos.forEach((g) => {
          if (!g.cursoId) return;
          if (!mapCursos.has(g.cursoId)) {
            mapCursos.set(g.cursoId, {
              id: g.cursoId,
              nombre: g.cursoNombre || "Curso sin nombre",
            });
          }
        });

        setCursos(Array.from(mapCursos.values()));
        setCursoSel("");
        setGruposFiltrados([]);
        setGrupoSel("");
        setGrupoActual(null);
        setAlumnos([]);
      } catch (err) {
        console.error(
          "Error cargando grupos del profesor:",
          err.response?.data || err
        );
        setError(
          err.response?.data?.error ||
            "No se pudieron cargar tus grupos asignados."
        );
      } finally {
        setLoadingGruposProfe(false);
      }
    };

    cargarGruposProfe();
  }, [user]);

  // 3) Cuando se elige un curso, filtrar grupos de ese curso
  useEffect(() => {
    if (!cursoSel) {
      setGruposFiltrados([]);
      setGrupoSel("");
      setGrupoActual(null);
      setAlumnos([]);
      return;
    }

    const filtrados = gruposProfe.filter((g) => g.cursoId === cursoSel);
    setGruposFiltrados(filtrados);
    setGrupoSel("");
    setGrupoActual(null);
    setAlumnos([]);
  }, [cursoSel, gruposProfe]);

  // 4) Cuando se elige grupo, cargar alumnos de ese grupo
  useEffect(() => {
    if (!grupoSel) {
      setGrupoActual(null);
      setAlumnos([]);
      return;
    }

    const g = gruposFiltrados.find((gr) => gr.id === grupoSel) || null;
    setGrupoActual(g);

    const cargarAlumnos = async () => {
      try {
        setLoadingAlumnos(true);
        setError("");
        console.log("GET /api/grupos/:id/alumnos con id =", grupoSel);

        const res = await api.get(`/api/grupos/${grupoSel}/alumnos`);
        setAlumnos(res.data || []);
      } catch (err) {
        console.error("Error cargando alumnos:", err.response?.data || err);
        setError(
          err.response?.data?.error || "No se pudieron cargar los alumnos."
        );
      } finally {
        setLoadingAlumnos(false);
      }
    };

    cargarAlumnos();
  }, [grupoSel, gruposFiltrados]);

  // ───────── Render ─────────

  if (!user) {
    return <p>Debes iniciar sesión.</p>;
  }

  const rol = (user.rol || "").toUpperCase();
  if (rol !== "PROFESOR") {
    return <p>Esta página está diseñada para docentes.</p>;
  }

  return (
    <div className="container">
      <h1>Bienvenido, {user.nombre || "profesor"}</h1>
      <h2>Mis grupos y cursos</h2>

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
      )}

      {loadingGruposProfe && <p>Cargando tus grupos...</p>}

      {!loadingGruposProfe && gruposProfe.length === 0 && (
        <p>
          No estás asignado a ningún grupo todavía. Cuando el administrador te
          asigne grupos, los verás aquí.
        </p>
      )}

      {/* SOLO mostramos selects si el profe tiene al menos un grupo */}
      {!loadingGruposProfe && gruposProfe.length > 0 && (
        <>
          {/* Selección de curso (solo cursos donde TIENE grupos) */}
          <div style={{ margin: "1rem 0" }}>
            <label>
              Curso:&nbsp;
              <select
                value={cursoSel}
                onChange={(e) => setCursoSel(e.target.value)}
              >
                <option value="">-- Selecciona un curso --</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Selección de grupo (solo grupos de ese curso) */}
          {cursoSel && (
            <div style={{ margin: "1rem 0" }}>
              <label>
                Grupo:&nbsp;
                {gruposFiltrados.length === 0 ? (
                  <span>No tienes grupos en este curso.</span>
                ) : (
                  <select
                    value={grupoSel}
                    onChange={(e) => setGrupoSel(e.target.value)}
                  >
                    <option value="">-- Selecciona un grupo --</option>
                    {gruposFiltrados.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre || g.cursoNombre || "Grupo sin nombre"}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
          )}

          {/* Detalle de grupo: horario + alumnos */}
          {grupoActual && (
            <div style={{ marginTop: "1.5rem" }}>
              <h3>Grupo: {grupoActual.nombre}</h3>
              <p>
                Curso: {grupoActual.cursoNombre || "N/D"}{" "}
                {grupoActual.totalAlumnos != null && (
                  <> – Matrículas: {grupoActual.totalAlumnos}</>
                )}
              </p>

              <h4>Horario y aulas</h4>
              {Array.isArray(grupoActual.horario) &&
              grupoActual.horario.length > 0 ? (
                <ul>
                  {grupoActual.horario.map((h, idx) => (
                    <li key={idx}>
                      Aula {h.aula || "N/D"} – Día {h.dia} – {h.inicio} a{" "}
                      {h.fin}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Este grupo no tiene horario registrado.</p>
              )}

              <h4>Alumnos matriculados</h4>
              {loadingAlumnos && <p>Cargando alumnos...</p>}

              {!loadingAlumnos && alumnos.length === 0 && (
                <p>No hay alumnos matriculados en este grupo.</p>
              )}

              {!loadingAlumnos && alumnos.length > 0 && (
                <ul>
                  {alumnos.map((al) => (
                    <li key={al.id}>
                      {al.nombre} – {al.email}
                      {al.documento && <> – Doc: {al.documento}</>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
