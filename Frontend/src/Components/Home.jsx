// src/Components/Home.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import FormMaterial from "./FormMaterial";
import FormTarea from "./FormTarea";

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

  // Tareas del grupo
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(false);

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

  // Edición de notas de entregas
  const [notaEdit, setNotaEdit] = useState({}); // { entregaId: "90" }
  const [comentarioEdit, setComentarioEdit] = useState({}); // { entregaId: "Buen trabajo" }
  const [savingNotaId, setSavingNotaId] = useState(null);

  // helper para formatear fecha de Firestore o Date/ISO
  const formatFecha = (ts) => {
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
        setTareas([]);
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
      setTareas([]);
      return;
    }

    const filtrados = gruposProfe.filter((g) => g.cursoId === cursoSel);
    setGruposFiltrados(filtrados);
    setGrupoSel("");
    setGrupoActual(null);
    setAlumnos([]);
    setMateriales([]);
    setTareas([]);
  }, [cursoSel, gruposProfe]);

  // 4) Cuando se elige grupo, cargar alumnos, materiales y tareas de ese grupo
  useEffect(() => {
    if (!grupoSel) {
      setGrupoActual(null);
      setAlumnos([]);
      setMateriales([]);
      setTareas([]);
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
        console.error("Error cargando materiales:", err.response?.data || err);
      } finally {
        setLoadingMateriales(false);
      }
    };

    const cargarTareas = async () => {
      try {
        setLoadingTareas(true);
        const res = await api.get("/api/tareas", {
          params: { grupoId: grupoSel },
        });

        const lista = (res.data || []).map((t) => ({
          ...t,
          entregas: [],
          mostrarEntregas: false,
          cargandoEntregas: false,
        }));

        setTareas(lista);
      } catch (err) {
        console.error("Error cargando tareas:", err.response?.data || err);
      } finally {
        setLoadingTareas(false);
      }
    };

    cargarAlumnos();
    cargarMateriales();
    cargarTareas();
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

  // ───────── Entregas de tareas (profesor) ─────────

  const toggleEntregas = async (tareaId) => {
    // Cambiar flag de mostrar/ocultar
    setTareas((prev) =>
      prev.map((t) =>
        t.id === tareaId ? { ...t, mostrarEntregas: !t.mostrarEntregas } : t
      )
    );

    // Si ya las teníamos cargadas, no volvemos a llamar a la API
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea || (tarea.entregas && tarea.entregas.length > 0)) {
      return;
    }

    // Cargar entregas desde el backend
    try {
      setTareas((prev) =>
        prev.map((t) =>
          t.id === tareaId ? { ...t, cargandoEntregas: true } : t
        )
      );

      const res = await api.get(`/api/tareas/${tareaId}/entregas`);
      const entregas = res.data || [];

      // precargar inputs de nota/comentario
      setNotaEdit((prev) => {
        const copia = { ...prev };
        entregas.forEach((e) => {
          if (e.nota != null && copia[e.id] === undefined) {
            copia[e.id] = String(e.nota);
          }
        });
        return copia;
      });
      setComentarioEdit((prev) => {
        const copia = { ...prev };
        entregas.forEach((e) => {
          if (e.comentario && copia[e.id] === undefined) {
            copia[e.id] = e.comentario;
          }
        });
        return copia;
      });

      setTareas((prev) =>
        prev.map((t) =>
          t.id === tareaId
            ? { ...t, entregas, cargandoEntregas: false }
            : t
        )
      );
    } catch (err) {
      console.error("Error cargando entregas:", err.response?.data || err);
      setTareas((prev) =>
        prev.map((t) =>
          t.id === tareaId ? { ...t, cargandoEntregas: false } : t
        )
      );
    }
  };

  const guardarNotaEntrega = async (entregaId, tareaId) => {
    const valor = notaEdit[entregaId];
    const comentario = comentarioEdit[entregaId] || "";
    const numero = Number(valor);

    if (Number.isNaN(numero)) {
      alert("La nota debe ser un número.");
      return;
    }
    if (numero < 0 || numero > 100) {
      alert("La nota debe estar entre 0 y 100.");
      return;
    }

    try {
      setSavingNotaId(entregaId);
      await api.put(`/api/entregas/${entregaId}/calificar`, {
        nota: numero,
        comentario,
      });

      // Actualizar en estado local
      setTareas((prev) =>
        prev.map((t) =>
          t.id !== tareaId
            ? t
            : {
                ...t,
                entregas: (t.entregas || []).map((e) =>
                  e.id === entregaId ? { ...e, nota: numero, comentario } : e
                ),
              }
        )
      );
      alert("Nota guardada correctamente.");
    } catch (err) {
      console.error("Error guardando nota:", err.response?.data || err);
      alert(
        err.response?.data?.error || "No se pudo guardar la nota. Intenta de nuevo."
      );
    } finally {
      setSavingNotaId(null);
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

          {/* Detalle de grupo: horario + alumnos + materiales + tareas */}
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

              {/* Tareas */}
              <h4 style={{ marginTop: "2rem" }}>Tareas del grupo</h4>

              {loadingTareas && <p>Cargando tareas...</p>}

              {!loadingTareas && tareas.length === 0 && (
                <p>No hay tareas creadas para este grupo.</p>
              )}

              {!loadingTareas && tareas.length > 0 && (
                <ul>
                  {tareas.map((t) => {
                    let fechaStr = "";
                    try {
                      const f = t.fechaLimite?.toDate
                        ? t.fechaLimite.toDate()
                        : new Date(t.fechaLimite);
                      fechaStr = f.toLocaleString();
                    } catch {
                      fechaStr = "";
                    }

                    const colorEstado =
                      t.estado === "expirada" ? "red" : "green";

                    return (
                      <li key={t.id} style={{ marginBottom: "0.75rem" }}>
                        <strong>{t.titulo}</strong>{" "}
                        <span style={{ color: colorEstado }}>
                          [{t.estado === "expirada" ? "Expirada" : "Activa"}]
                        </span>
                        <div>{t.descripcion}</div>
                        <small>Fecha límite: {fechaStr}</small>

                        <div style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => toggleEntregas(t.id)}
                          >
                            {t.mostrarEntregas
                              ? "Ocultar entregas"
                              : "Ver entregas"}
                          </button>
                        </div>

                        {/* Entregas de la tarea */}
                        {t.mostrarEntregas && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              marginLeft: "1rem",
                              borderLeft: "2px solid #ccc",
                              paddingLeft: "0.75rem",
                            }}
                          >
                            {t.cargandoEntregas && (
                              <p>Cargando entregas...</p>
                            )}

                            {!t.cargandoEntregas &&
                              (!t.entregas || t.entregas.length === 0) && (
                                <p>No hay entregas registradas.</p>
                              )}

                            {!t.cargandoEntregas &&
                              t.entregas &&
                              t.entregas.length > 0 && (
                                <ul>
                                  {t.entregas.map((e) => {
                                    const nombreMostrado =
                                      e.alumnoNombre ||
                                      e.alumnoEmail ||
                                      e.alumnoId;
                                    const fechaEntrega =
                                      e.entregadaEn || e.createdAt;

                                    return (
                                      <li
                                        key={e.id}
                                        style={{ marginBottom: "0.75rem" }}
                                      >
                                        <strong>{nombreMostrado}</strong>
                                        {e.alumnoEmail && (
                                          <> — {e.alumnoEmail}</>
                                        )}
                                        <div>
                                          Entregada:{" "}
                                          {formatFecha(fechaEntrega)}
                                        </div>
                                        {e.archivoUrl && (
                                          <div>
                                            Archivo:{" "}
                                            <a
                                              href={e.archivoUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {e.archivoNombre ||
                                                "Descargar"}
                                            </a>
                                          </div>
                                        )}
                                        {e.enlace && (
                                          <div>
                                            Enlace:{" "}
                                            <a
                                              href={e.enlace}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {e.enlace}
                                            </a>
                                          </div>
                                        )}

                                        {/* Nota y comentario */}
                                        <div
                                          style={{
                                            marginTop: "0.35rem",
                                            padding: "0.35rem 0.5rem",
                                            background: "#f7f7f7",
                                            borderRadius: 4,
                                          }}
                                        >
                                          <div>
                                            <label>
                                              Nota (0–100):{" "}
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={
                                                  notaEdit[e.id] ??
                                                  (e.nota != null
                                                    ? String(e.nota)
                                                    : "")
                                                }
                                                onChange={(ev) =>
                                                  setNotaEdit((prev) => ({
                                                    ...prev,
                                                    [e.id]: ev.target.value,
                                                  }))
                                                }
                                                style={{ width: "80px" }}
                                              />
                                            </label>
                                            {e.nota != null && (
                                              <span
                                                style={{
                                                  marginLeft: "0.5rem",
                                                  fontSize: "0.9rem",
                                                  opacity: 0.7,
                                                }}
                                              >
                                                (actual: {e.nota})
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ marginTop: "0.25rem" }}>
                                            <label>
                                              Comentario:
                                              <textarea
                                                value={
                                                  comentarioEdit[e.id] ??
                                                  e.comentario ??
                                                  ""
                                                }
                                                onChange={(ev) =>
                                                  setComentarioEdit((prev) => ({
                                                    ...prev,
                                                    [e.id]: ev.target.value,
                                                  }))
                                                }
                                                style={{
                                                  width: "100%",
                                                  minHeight: "50px",
                                                }}
                                              />
                                            </label>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              guardarNotaEntrega(e.id, t.id)
                                            }
                                            disabled={savingNotaId === e.id}
                                          >
                                            {savingNotaId === e.id
                                              ? "Guardando..."
                                              : "Guardar nota"}
                                          </button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Formulario para crear nueva tarea */}
              <FormTarea
                cursoId={grupoActual.cursoId}
                grupoId={grupoActual.id}
                onCreated={(nueva) => setTareas((prev) => [...prev, nueva])}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
