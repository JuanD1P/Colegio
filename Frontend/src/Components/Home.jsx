// src/Components/Home.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import FormMaterial from "./FormMaterial";

export default function Home() {
  const [user, setUser] = useState(null);

  // Grupos del profesor
  const [gruposProfe, setGruposProfe] = useState([]);
  const [cursos, setCursos] = useState([]);

  const [cursoSel, setCursoSel] = useState("");
  const [gruposFiltrados, setGruposFiltrados] = useState([]);
  const [grupoSel, setGrupoSel] = useState("");
  const [grupoActual, setGrupoActual] = useState(null);

  // Alumnos del grupo
  const [alumnos, setAlumnos] = useState([]);

  // Materiales del grupo
  const [materiales, setMateriales] = useState([]);
  const [loadingMateriales, setLoadingMateriales] = useState(false);

  const [loadingGruposProfe, setLoadingGruposProfe] = useState(false);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [error, setError] = useState("");

  // Edición de materiales
  const [editId, setEditId] = useState(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editEnlace, setEditEnlace] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // helper para formatear fecha de Firestore
  const formatFecha = (ts) => {
    if (!ts) return "";
    try {
      // si viene como Timestamp de Firestore
      if (typeof ts.toDate === "function") {
        return ts.toDate().toLocaleString();
      }
      // si viene como {_seconds, _nanoseconds}
      if (ts._seconds || ts.seconds) {
        const secs = ts._seconds ?? ts.seconds;
        return new Date(secs * 1000).toLocaleString();
      }
      // si viene como string o number
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  };

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
        setMateriales([]);
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
      setMateriales([]);
      return;
    }

    const filtrados = gruposProfe.filter((g) => g.cursoId === cursoSel);
    setGruposFiltrados(filtrados);
    setGrupoSel("");
    setGrupoActual(null);
    setAlumnos([]);
    setMateriales([]);
  }, [cursoSel, gruposProfe]);

  // 4) Cuando se elige grupo, cargar alumnos y materiales de ese grupo
  useEffect(() => {
    if (!grupoSel) {
      setGrupoActual(null);
      setAlumnos([]);
      setMateriales([]);
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

    const cargarMateriales = async () => {
      try {
        setLoadingMateriales(true);
        const res = await api.get("/api/materiales", {
          params: { grupoId: grupoSel },
        });
        setMateriales(res.data || []);
      } catch (err) {
        console.error(
          "Error cargando materiales:",
          err.response?.data || err
        );
      } finally {
        setLoadingMateriales(false);
      }
    };

    cargarAlumnos();
    cargarMateriales();
  }, [grupoSel, gruposFiltrados]);

  // ───────── Acciones de materiales ─────────

  const startEdit = (m) => {
    setEditId(m.id);
    setEditTitulo(m.titulo || "");
    setEditDescripcion(m.descripcion || "");
    setEditEnlace(m.enlace || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitulo("");
    setEditDescripcion("");
    setEditEnlace("");
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      setSavingEdit(true);
      await api.put(`/api/materiales/${editId}`, {
        titulo: editTitulo,
        descripcion: editDescripcion,
        enlace: editEnlace,
      });

      setMateriales((prev) =>
        prev.map((m) =>
          m.id === editId
            ? {
                ...m,
                titulo: editTitulo,
                descripcion: editDescripcion,
                enlace: editEnlace,
              }
            : m
        )
      );
      cancelEdit();
    } catch (err) {
      console.error("Error actualizando material:", err.response?.data || err);
      alert(
        err.response?.data?.error ||
          "No se pudo actualizar el material. Intenta nuevamente."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteMaterial = async (m) => {
    const ok = window.confirm(
      `¿Seguro que quieres eliminar el material "${m.titulo}"?`
    );
    if (!ok) return;

    try {
      setDeletingId(m.id);
      await api.delete(`/api/materiales/${m.id}`);
      setMateriales((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      console.error("Error eliminando material:", err.response?.data || err);
      alert(
        err.response?.data?.error ||
          "No se pudo eliminar el material. Intenta nuevamente."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ───────── Render ─────────

  if (!user) {
    return <p>Debes iniciar sesión.</p>;
  }

  const rol = (user.rol || "").toUpperCase();
  if (rol !== "PROFESOR") {
    return <p>Esta página está diseñada para docentes.</p>;
  }

  return (
    <div
      className="container"
      style={{
        maxHeight: "calc(100vh - 120px)", // deja espacio para navbar/footer
        overflowY: "auto",
        paddingBottom: "2rem",
      }}
    >
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
                        {g.nombre || g.cursoNombre || "Grupo sin nombre"}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
          )}

          {/* Detalle de grupo: horario + alumnos + materiales */}
          {grupoActual && (
            <div style={{ marginTop: "1.5rem" }}>
              <h3>Grupo: {grupoActual.nombre}</h3>
              <p>
                Curso: {grupoActual.cursoNombre || "N/D"}{" "}
                {grupoActual.totalAlumnos != null && (
                  <> – Matrículas: {grupoActual.totalAlumnos}</>
                )}
              </p>

              {/* Horario */}
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

              {/* Alumnos */}
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

              {/* Materiales */}
              <h4>Materiales publicados</h4>
              {loadingMateriales && <p>Cargando materiales...</p>}

              {!loadingMateriales && materiales.length === 0 && (
                <p>No hay materiales publicados para este grupo.</p>
              )}

              {!loadingMateriales && materiales.length > 0 && (
                <ul>
                  {materiales.map((m) => (
                    <li key={m.id} style={{ marginBottom: "0.75rem" }}>
                      {editId === m.id ? (
                        // ----- MODO EDICIÓN -----
                        <div
                          style={{
                            border: "1px solid #ccc",
                            padding: "0.5rem",
                            borderRadius: "4px",
                          }}
                        >
                          <div>
                            <label>
                              Título:
                              <input
                                type="text"
                                value={editTitulo}
                                onChange={(e) =>
                                  setEditTitulo(e.target.value)
                                }
                                style={{ width: "100%" }}
                              />
                            </label>
                          </div>
                          <div>
                            <label>
                              Descripción:
                              <textarea
                                value={editDescripcion}
                                onChange={(e) =>
                                  setEditDescripcion(e.target.value)
                                }
                                style={{ width: "100%", minHeight: "60px" }}
                              />
                            </label>
                          </div>
                          <div>
                            <label>
                              Enlace:
                              <input
                                type="url"
                                value={editEnlace}
                                onChange={(e) =>
                                  setEditEnlace(e.target.value)
                                }
                                style={{ width: "100%" }}
                              />
                            </label>
                          </div>
                          <div style={{ marginTop: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={savingEdit}
                            >
                              {savingEdit ? "Guardando..." : "Guardar"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              style={{ marginLeft: "0.5rem" }}
                              disabled={savingEdit}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        // ----- MODO LECTURA -----
                        <div>
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

                          <div style={{ marginTop: "0.25rem" }}>
                            <button
                              type="button"
                              onClick={() => startEdit(m)}
                              style={{ marginRight: "0.5rem" }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMaterial(m)}
                              disabled={deletingId === m.id}
                            >
                              {deletingId === m.id
                                ? "Eliminando..."
                                : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Formulario para publicar nuevo material */}
              <FormMaterial
                cursoId={grupoActual.cursoId}
                grupoId={grupoActual.id}
                onUploaded={(nuevo) =>
                  setMateriales((prev) => [nuevo, ...prev])
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
