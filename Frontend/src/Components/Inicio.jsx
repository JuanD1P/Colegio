// src/Components/Inicio.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import FormEntregaTarea from "./FormEntregaTarea";
import "./DOCSS/InicioEst.css";

// ───────── Helpers ─────────

// Comprueba si el perfil tiene los campos básicos llenos
function tienePerfilCompletoEnCampos(user) {
  if (!user) return false;

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

        const res = await api.get(`/api/alumnos/${user.id}/grupos`);
        const arr = res.data || [];
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

  // 4) Cuando se elige grupo, cargar materiales + tareas
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
        const res = await api.get("/api/tareas", {
          params: { grupoId: grupoSel, soloActivas: true },
        });
        const base = res.data || [];

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
    <div className="estu-page">
      <div className="estu-overlay" />

      <div className="estu-frame">
        {/* HEADER */}
        <header className="estu-header glass-strong">
          <div>
            <h1 className="estu-title">
              Hola, {user.nombre || user.nombres || "estudiante"}
            </h1>
            <p className="estu-subtitle">
              Revisa tu progreso, tareas y materiales desde aquí.
            </p>
          </div>
          <div className="estu-headerBadge">
            <span className="estu-badge">Panel de Estudiante</span>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="estu-main glass-strong">
          {mostrarBanner && (
            <div className="estu-bannerPerfil">
              <div className="estu-bannerText">
                <strong>⚠ Completa tu perfil</strong>
                <span>
                  Para aprovechar al máximo la plataforma, por favor revisa y
                  actualiza tus datos personales.
                </span>
              </div>
              <button
                type="button"
                className="estu-btn estu-btn--primary"
                onClick={() => navigate("/perfil")}
              >
                Completar / editar perfil
              </button>
            </div>
          )}

          {error && <p className="estu-error">{error}</p>}

          {loading && (
            <p className="estu-info">Cargando tus grupos...</p>
          )}

          {!loading && grupos.length === 0 && !error && (
            <p className="estu-info">
              No estás matriculado en ningún grupo actualmente.
            </p>
          )}

          {/* Si tiene grupos, mostramos select de curso y grupo */}
          {!loading && grupos.length > 0 && (
            <>
              {/* Selección de curso y grupo */}
              <section className="estu-section">
                <h2 className="estu-sectionTitle">Mis cursos y grupos</h2>

                <div className="estu-row">
                  <div className="estu-field">
                    <span className="estu-label">Curso</span>
                    <select
                      className="estu-select"
                      value={cursoSel}
                      onChange={(e) => setCursoSel(e.target.value)}
                    >
                      <option value="">Selecciona un curso</option>
                      {cursos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {cursoSel && (
                  <div className="estu-row">
                    <div className="estu-field">
                      <span className="estu-label">Grupo</span>
                      {gruposFiltrados.length === 0 ? (
                        <span className="estu-info">
                          No tienes grupos en este curso.
                        </span>
                      ) : (
                        <select
                          className="estu-select"
                          value={grupoSel}
                          onChange={(e) => setGrupoSel(e.target.value)}
                        >
                          <option value="">Selecciona un grupo</option>
                          {gruposFiltrados.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nombreGrupo ||
                                g.nombre ||
                                "Grupo sin nombre"}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Detalle del grupo seleccionado + materiales + tareas */}
              {grupoActual && (
                <section className="estu-section estu-section--card">
                  {/* Cabecera grupo */}
                  <header className="estu-groupHeader">
                    <div>
                      <h2 className="estu-sectionTitle">
                        {grupoActual.cursoNombre || "Curso sin nombre"}
                      </h2>
                      <p className="estu-groupMeta">
                        Grupo:{" "}
                        {grupoActual.nombreGrupo ||
                          grupoActual.nombre ||
                          "Sin nombre"}
                      </p>
                      {grupoActual.profesorNombre && (
                        <p className="estu-groupMeta">
                          Profesor: {grupoActual.profesorNombre}
                          {grupoActual.profesorEmail &&
                            ` (${grupoActual.profesorEmail})`}
                        </p>
                      )}
                    </div>
                  </header>

                  {/* Horario */}
                  <div className="estu-block">
                    <h3 className="estu-subsectionTitle">Horario del grupo</h3>
                    {Array.isArray(grupoActual.horario) &&
                    grupoActual.horario.length > 0 ? (
                      <ul className="estu-list">
                        {grupoActual.horario.map((h, idx) => (
                          <li key={idx} className="estu-listItem">
                            <span>
                              Aula <strong>{h.aula || "N/D"}</strong>
                            </span>
                            <span className="estu-listSecondary">
                              Día {h.dia} · {h.inicio} – {h.fin}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="estu-info">
                        Este grupo no tiene horario registrado.
                      </p>
                    )}
                  </div>

                  {/* Materiales */}
                  <div className="estu-block">
                    <h3 className="estu-subsectionTitle">
                      Materiales del grupo
                    </h3>

                    {loadingMateriales && (
                      <p className="estu-info">Cargando materiales...</p>
                    )}

                    {!loadingMateriales && materiales.length === 0 && (
                      <p className="estu-info">
                        No hay materiales publicados para este grupo.
                      </p>
                    )}

                    {!loadingMateriales && materiales.length > 0 && (
                      <ul className="estu-materialList">
                        {materiales.map((m) => (
                          <li key={m.id} className="estu-materialItem">
                            <div className="estu-materialHeader">
                              <div>
                                <strong>{m.titulo}</strong>
                                <small>{formatFecha(m.createdAt)}</small>
                              </div>
                            </div>

                            {m.descripcion && (
                              <p className="estu-materialDesc">
                                {m.descripcion}
                              </p>
                            )}

                            {m.archivoUrl && (
                              <p className="estu-materialLink">
                                Archivo:&nbsp;
                                <a
                                  href={m.archivoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {m.archivoNombre || "Descargar"}
                                </a>
                              </p>
                            )}

                            {m.enlace && (
                              <p className="estu-materialLink">
                                Enlace:&nbsp;
                                <a
                                  href={m.enlace}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {m.enlace}
                                </a>
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Promedio simple del curso */}
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
                      <div className="estu-promedioCard">
                        <div className="estu-promedioMain">
                          <strong>Promedio del curso (sobre 100)</strong>
                          <div className="estu-promedioSub">
                            Calculado con las tareas que ya tienen nota.
                          </div>
                        </div>
                        <div className="estu-promedioValue">
                          {promedio.toFixed(1)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tareas */}
                  <div className="estu-block">
                    <h3 className="estu-subsectionTitle">Tareas asignadas</h3>

                    {loadingTareas && (
                      <p className="estu-info">Cargando tareas...</p>
                    )}

                    {!loadingTareas && tareas.length === 0 && (
                      <p className="estu-info">
                        No hay tareas activas para este grupo.
                      </p>
                    )}

                    {!loadingTareas && tareas.length > 0 && (
                      <div className="estu-tareas">
                        {tareas.map((t) => {
                          const limite = parseFechaLimite(t.fechaLimite);
                          const entrega = t.miEntrega || null;

                          let estadoTexto = "Sin entregar";
                          let estadoColor = "estu-chip--neutral";

                          if (entrega) {
                            if (typeof entrega.nota === "number") {
                              estadoTexto = "Calificada";
                              estadoColor = "estu-chip--ok";
                            } else {
                              estadoTexto = "Entregada (en revisión)";
                              estadoColor = "estu-chip--info";
                            }
                          }

                          return (
                            <div key={t.id} className="estu-tareaCard">
                              <div className="estu-tareaHeader">
                                <div>
                                  <strong>{t.titulo}</strong>
                                  {limite && (
                                    <small>
                                      Límite: {limite.toLocaleString()}
                                    </small>
                                  )}
                                </div>
                                <span
                                  className={`estu-chip ${estadoColor}`}
                                >
                                  {estadoTexto}
                                </span>
                              </div>

                              {t.descripcion && (
                                <p className="estu-tareaDesc">
                                  {t.descripcion}
                                </p>
                              )}

                              {/* Bloque de nota / entrega */}
                              {entrega && (
                                <div className="estu-entregaResumen">
                                  <div className="estu-notaBubble">
                                    {typeof entrega.nota === "number"
                                      ? entrega.nota
                                      : "—"}
                                  </div>
                                  <div className="estu-entregaTexto">
                                    <div>
                                      <strong>
                                        {typeof entrega.nota === "number"
                                          ? "Tu nota:"
                                          : "Tu entrega aún no tiene nota."}
                                      </strong>
                                    </div>
                                    <div>
                                      Entregada:{" "}
                                      {formatFecha(
                                        entrega.entregadaEn ||
                                          entrega.createdAt
                                      )}
                                    </div>
                                    {entrega.comentario && (
                                      <div className="estu-entregaComentario">
                                        “{entrega.comentario}”
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Formulario para entregar / re-entregar tarea */}
                              <div className="estu-entregaWrapper">
                                <FormEntregaTarea
                                  tarea={t}
                                  miEntrega={t.miEntrega || null}
                                  onSubmitted={(nuevaEntrega) => {
                                    setTareas((prev) =>
                                      prev.map((x) =>
                                        x.id === t.id ? { ...x, miEntrega: nuevaEntrega } : x
                                      )
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
