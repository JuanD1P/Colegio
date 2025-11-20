// src/Components/Inicio.jsxxd
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import FormEntregaTarea from "./FormEntregaTarea";

// ───────── Helpers ─────────

// Comprueba si el perfil tiene los campos básicos llenos
function tienePerfilCompletoEnCampos(user) {
  if (!user) return false;

  // Ajusta los nombres de campos a los que guardas en Firestore
  const requeridos = [
    "nombres",
    "apellidos",
    "tipoDoc",
    "documento",
    "telefono",
    "direccion",
    "grado",
    "seccion",
    "fechaNac",
    "acudienteNombre",
    "acudienteTelefono",
  ];

  return requeridos.every((campo) => {
    const v = user[campo];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  });
}

// Formatea la fecha de Firestore / JS
function formatFecha(ts) {
  if (!ts) return "";
  try {
    if (typeof ts.toDate === "function") {
      return ts.toDate().toLocaleString();
    }
    if (ts._seconds || ts.seconds) {
      const secs = ts._seconds ?? ts.seconds;
      return new Date(secs * 1000).toLocaleString();
    }
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

// Para fecha límite de tareas
function parseFechaLimite(valor) {
  if (!valor) return null;
  try {
    if (typeof valor.toDate === "function") {
      return valor.toDate();
    }
    if (valor._seconds || valor.seconds) {
      const secs = valor._seconds ?? valor.seconds;
      return new Date(secs * 1000);
    }
    return new Date(valor);
  } catch {
    return null;
  }
}

export default function Inicio() {
  const [user, setUser] = useState(null);

  // Grupos del estudiante
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selección curso / grupo
  const [cursos, setCursos] = useState([]);
  const [cursoSel, setCursoSel] = useState("");
  const [gruposFiltrados, setGruposFiltrados] = useState([]);
  const [grupoSel, setGrupoSel] = useState("");
  const [grupoActual, setGrupoActual] = useState(null);

  // Materiales del grupo seleccionado
  const [materiales, setMateriales] = useState([]);
  const [loadingMateriales, setLoadingMateriales] = useState(false);

  // Tareas del grupo seleccionado (con miEntrega incluida)
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(false);

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

    const cargarGrupos = async () => {
      try {
        setLoading(true);
        setError("");
        console.log("GET /api/alumnos/:id/grupos con id =", user.id);

        const res = await api.get(`/api/alumnos/${user.id}/grupos`);
        const arr = res.data || [];
        console.log("Grupos del estudiante:", arr);
        setGrupos(arr);

        // Derivar cursos únicos a partir de esos grupos
        const mapCursos = new Map();
        arr.forEach((g) => {
          if (!g.cursoId) return;
          if (!mapCursos.has(g.cursoId)) {
            mapCursos.set(g.cursoId, {
              id: g.cursoId,
              nombre: g.cursoNombre || "Curso sin nombre",
            });
          }
        });
        setCursos(Array.from(mapCursos.values()));

        // Reset selección
        setCursoSel("");
        setGruposFiltrados([]);
        setGrupoSel("");
        setGrupoActual(null);
        setMateriales([]);
        setTareas([]);
      } catch (err) {
        console.error(
          "Error cargando grupos alumno:",
          err.response?.data || err
        );
        setError(
          err.response?.data?.error || "No se pudieron cargar tus grupos."
        );
      } finally {
        setLoading(false);
      }
    };

    cargarGrupos();
  }, [user]);

  // 3) Cuando se elige un curso, filtrar grupos de ese curso
  useEffect(() => {
    if (!cursoSel) {
      setGruposFiltrados([]);
      setGrupoSel("");
      setGrupoActual(null);
      setMateriales([]);
      setTareas([]);
      return;
    }

    const filtrados = grupos.filter((g) => g.cursoId === cursoSel);
    setGruposFiltrados(filtrados);
    setGrupoSel("");
    setGrupoActual(null);
    setMateriales([]);
    setTareas([]);
  }, [cursoSel, grupos]);

  // 4) Cuando se elige grupo, guardar grupo actual y cargar materiales + tareas
  useEffect(() => {
    if (!grupoSel) {
      setGrupoActual(null);
      setMateriales([]);
      setTareas([]);
      return;
    }

    const g = gruposFiltrados.find((gr) => gr.id === grupoSel) || null;
    setGrupoActual(g);

    // Materiales
    const cargarMateriales = async () => {
      try {
        setLoadingMateriales(true);
        console.log("GET /api/materiales?grupoId=", grupoSel);
        const res = await api.get("/api/materiales", {
          params: { grupoId: grupoSel },
        });
        setMateriales(res.data || []);
      } catch (err) {
        console.error(
          "Error cargando materiales (alumno):",
          err.response?.data || err
        );
      } finally {
        setLoadingMateriales(false);
      }
    };

    // Tareas + mi entrega
    const cargarTareas = async () => {
      try {
        setLoadingTareas(true);
        console.log("GET /api/tareas?grupoId=", grupoSel);
        const res = await api.get("/api/tareas", {
          params: { grupoId: grupoSel, soloActivas: true },
        });
        const base = res.data || [];

        // Para cada tarea, traer mi entrega (si existe)
        const conEntrega = await Promise.all(
          base.map(async (t) => {
            try {
              const r = await api.get(`/api/tareas/${t.id}/mi-entrega`);
              return { ...t, miEntrega: r.data || null };
            } catch (e) {
              console.error(
                "Error cargando mi-entrega para tarea",
                t.id,
                e.response?.data || e
              );
              return { ...t, miEntrega: null };
            }
          })
        );

        setTareas(conEntrega);
      } catch (err) {
        console.error(
          "Error cargando tareas (alumno):",
          err.response?.data || err
        );
      } finally {
        setLoadingTareas(false);
      }
    };

    cargarMateriales();
    cargarTareas();
  }, [grupoSel, gruposFiltrados]);

  // ───────── Render ─────────

  if (!user) {
    return <p>Debes iniciar sesión.</p>;
  }

  const rol = (user.rol || "").toUpperCase();
  if (rol !== "ESTUDIANTE") {
    return <p>Esta página está diseñada para estudiantes.</p>;
  }

  // Perfil: banner solo si de verdad le faltan datos
  const perfilCompletoFlag = user.perfilCompleto === true;
  const perfilCompletoCampos = tienePerfilCompletoEnCampos(user);
  const mostrarBanner = !perfilCompletoFlag && !perfilCompletoCampos;

  return (
    <div
      className="container"
      style={{
        maxHeight: "calc(100vh - 120px)", // deja espacio para navbar/footer
        overflowY: "auto",
        paddingBottom: "2rem",
      }}
    >
      <h1>Hola, {user.nombre || user.nombres || "estudiante"}</h1>
      <h2>Mis grupos / cursos</h2>

      {mostrarBanner && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffeeba",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            margin: "1rem 0",
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>⚠ Antes de ver todos los servicios del sistema</strong> es
            recomendable que completes tu información personal.
          </div>
          <button onClick={() => navigate("/perfil")}>
            Completar / editar perfil
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
      )}

      {loading && <p>Cargando tus grupos...</p>}

      {!loading && grupos.length === 0 && !error && (
        <p>No estás matriculado en ningún grupo actualmente.</p>
      )}

      {/* Si tiene grupos, mostramos select de curso y grupo */}
      {!loading && grupos.length > 0 && (
        <>
          {/* Selección de curso */}
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

          {/* Selección de grupo */}
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
                        {g.nombreGrupo || g.nombre || "Grupo sin nombre"}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
          )}

          {/* Detalle del grupo seleccionado + materiales + tareas */}
          {grupoActual && (
            <div
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
              }}
            >
              <h3>{grupoActual.cursoNombre || "Curso sin nombre"}</h3>
              <p>
                <strong>Grupo:</strong>{" "}
                {grupoActual.nombreGrupo ||
                  grupoActual.nombre ||
                  "Sin nombre"}
              </p>
              {grupoActual.profesorNombre && (
                <p>
                  <strong>Profesor:</strong> {grupoActual.profesorNombre}
                  {grupoActual.profesorEmail &&
                    ` (${grupoActual.profesorEmail})`}
                </p>
              )}

              <h4>Horario</h4>
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

              {/* Materiales del grupo */}
              <h4>Materiales del grupo</h4>
              {loadingMateriales && <p>Cargando materiales...</p>}

              {!loadingMateriales && materiales.length === 0 && (
                <p>No hay materiales publicados para este grupo.</p>
              )}

              {!loadingMateriales && materiales.length > 0 && (
                <ul>
                  {materiales.map((m) => (
                    <li key={m.id} style={{ marginBottom: "0.75rem" }}>
                      <strong>{m.titulo}</strong>{" "}
                      <small>{formatFecha(m.createdAt)}</small>
                      {m.descripcion && <div>{m.descripcion}</div>}
                      {m.archivoUrl && (
                        <div>
                          Archivo:{" "}
                          <a
                            href={m.archivoUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {m.archivoNombre || "Descargar"}
                          </a>
                        </div>
                      )}
                      {m.enlace && (
                        <div>
                          Enlace:{" "}
                          <a
                            href={m.enlace}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {m.enlace}
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Promedio simple del curso (solo tareas con nota) */}
              {(() => {
                const tareasConNota = tareas.filter(
                  (t) =>
                    t.miEntrega &&
                    typeof t.miEntrega.nota === "number" &&
                    !Number.isNaN(t.miEntrega.nota)
                );
                if (tareasConNota.length === 0) return null;

                const suma = tareasConNota.reduce(
                  (acc, t) => acc + t.miEntrega.nota,
                  0
                );
                const promedio = suma / tareasConNota.length;

                return (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      background: "#e8f4ff",
                      border: "1px solid #b6e0fe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong>Promedio del curso (sobre 100):</strong>
                      <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                        Calculado con las tareas que ya tienen nota.
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "1.6rem",
                        fontWeight: "bold",
                      }}
                    >
                      {promedio.toFixed(1)}
                    </div>
                  </div>
                );
              })()}

              {/* Tareas del grupo */}
              <h4 style={{ marginTop: "1rem" }}>Tareas asignadas</h4>
              {loadingTareas && <p>Cargando tareas...</p>}

              {!loadingTareas && tareas.length === 0 && (
                <p>No hay tareas activas para este grupo.</p>
              )}

              {!loadingTareas && tareas.length > 0 && (
                <div>
                  {tareas.map((t) => {
                    const limite = parseFechaLimite(t.fechaLimite);
                    const entrega = t.miEntrega || null;

                    let estadoTexto = "Sin entregar";
                    let estadoColor = "#6c757d";

                    if (entrega) {
                      if (typeof entrega.nota === "number") {
                        estadoTexto = "Calificada";
                        estadoColor = "#28a745";
                      } else {
                        estadoTexto = "Entregada (en revisión)";
                        estadoColor = "#17a2b8";
                      }
                    }

                    return (
                      <div
                        key={t.id}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 6,
                          padding: "0.75rem 0.9rem",
                          marginBottom: "0.75rem",
                          background: "#fafafa",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong>{t.titulo}</strong>{" "}
                            {limite && (
                              <small>– Límite: {limite.toLocaleString()}</small>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: "bold",
                              color: estadoColor,
                            }}
                          >
                            {estadoTexto}
                          </span>
                        </div>

                        {t.descripcion && (
                          <p style={{ marginTop: "0.25rem" }}>
                            {t.descripcion}
                          </p>
                        )}

                        {/* Bloque bonito de nota si existe entrega */}
                        {entrega && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              padding: "0.6rem 0.75rem",
                              borderRadius: 6,
                              border: "1px solid #d1ecf1",
                              background: "#f1f9ff",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background:
                                  typeof entrega.nota === "number"
                                    ? "#d4edda"
                                    : "#ffeeba",
                                border:
                                  typeof entrega.nota === "number"
                                    ? "2px solid #28a745"
                                    : "2px solid #ffc107",
                                fontWeight: "bold",
                                fontSize:
                                  typeof entrega.nota === "number"
                                    ? "1.3rem"
                                    : "0.9rem",
                              }}
                            >
                              {typeof entrega.nota === "number"
                                ? entrega.nota
                                : "—"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "0.9rem" }}>
                                <strong>
                                  {typeof entrega.nota === "number"
                                    ? "Tu nota:"
                                    : "Tu entrega aún no tiene nota."}
                                </strong>
                              </div>
                              <div style={{ fontSize: "0.9rem" }}>
                                Entregada:{" "}
                                {formatFecha(
                                  entrega.entregadaEn || entrega.createdAt
                                )}
                              </div>
                              {entrega.comentario && (
                                <div
                                  style={{
                                    marginTop: "0.25rem",
                                    fontSize: "0.9rem",
                                    fontStyle: "italic",
                                  }}
                                >
                                  “{entrega.comentario}”
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Formulario para entregar / re-entregar tarea */}
                        <FormEntregaTarea
                          tarea={t}
                          miEntrega={t.miEntrega || null}
                          onSubmitted={(nuevaEntrega) => {
                            // actualizamos solo esa tarea con la nueva entrega
                            setTareas((prev) =>
                              prev.map((x) =>
                                x.id === t.id ? { ...x, miEntrega: nuevaEntrega } : x
                              )
                            );
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
