// src/Components/Home.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import FormMaterial from "./FormMaterial";
import "./DOCSS/HomeProfe.css";

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
  const [notaEdit, setNotaEdit] = useState({});
  const [comentarioEdit, setComentarioEdit] = useState({});
  const [savingNotaId, setSavingNotaId] = useState(null);

  // helper para formatear fecha de Firestore
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

        const res = await api.get(`/api/profesores/${user.id}/grupos`);
        const grupos = res.data || [];
        setGruposProfe(grupos);

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

  // 3) Filtrar grupos por curso
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
        err.response?.data?.error ||
          "No se pudo guardar la nota. Intenta de nuevo."
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
    <div className="profe-page">
      <div className="profe-overlay" />

      <div className="profe-frame">
        {/* HEADER */}
        <header className="profe-header glass-strong">
          <div>
            <h1 className="profe-title">Hola, {user.nombre || "profesor"}</h1>
            <p className="profe-subtitle">
              Gestiona tus cursos, grupos y materiales desde aquí.
            </p>
          </div>

          <div className="profe-headerBadge">
            <span className="profe-badge">Panel de Profesor</span>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="profe-main glass-strong">
          {error && <p className="profe-error">{error}</p>}

          {loadingGruposProfe && (
            <p className="profe-info">Cargando tus grupos...</p>
          )}

          {!loadingGruposProfe && gruposProfe.length === 0 && (
            <p className="profe-info">
              No estás asignado a ningún grupo todavía. Cuando el administrador
              te asigne grupos, los verás aquí.
            </p>
          )}

          {!loadingGruposProfe && gruposProfe.length > 0 && (
            <>
              {/* Selección de curso / grupo */}
              <section className="profe-section">
                <h2 className="profe-sectionTitle">Mis cursos y grupos</h2>

                <div className="profe-row">
                  <div className="profe-field">
                    <span className="profe-label">Curso</span>
                    <select
                      className="profe-select"
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
                  <div className="profe-row">
                    <div className="profe-field">
                      <span className="profe-label">Grupo</span>
                      {gruposFiltrados.length === 0 ? (
                        <span className="profe-info">
                          No tienes grupos en este curso.
                        </span>
                      ) : (
                        <select
                          className="profe-select"
                          value={grupoSel}
                          onChange={(e) => setGrupoSel(e.target.value)}
                        >
                          <option value="">Selecciona un grupo</option>
                          {gruposFiltrados.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nombre || g.cursoNombre || "Grupo sin nombre"}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {!cursoSel && gruposProfe.length > 0 && (
                <section className="profe-section profe-emptyState glass-soft">
                  <div className="profe-emptyIcon">📘</div>
                  <div className="profe-emptyContent">
                    <h3>Empieza eligiendo un curso</h3>
                    <p>
                      Selecciona un curso en el menú superior para ver sus grupos,
                      alumnos matriculados y los materiales que has publicado.
                    </p>
                    <ul>
                      <li>1. Elige un <strong>curso</strong>.</li>
                      <li>2. Selecciona un <strong>grupo</strong>.</li>
                      <li>3. Publica o gestiona <strong>materiales</strong> para tus clases.</li>
                    </ul>
                  </div>
                </section>
              )}

              {/* Detalle del grupo */}
              {grupoActual && (
                <section className="profe-section profe-section--card">
                  <header className="profe-groupHeader">
                    <div>
                      <h2 className="profe-sectionTitle">
                        Grupo: {grupoActual.nombre}
                      </h2>
                      <p className="profe-groupMeta">
                        Curso: {grupoActual.cursoNombre || "N/D"}
                        {grupoActual.totalAlumnos != null && (
                          <> · Matrículas: {grupoActual.totalAlumnos}</>
                        )}
                      </p>
                    </div>
                  </header>

                  {/* Horario */}
                  <div className="profe-block">
                    <h3 className="profe-subsectionTitle">Horario y aulas</h3>
                    {Array.isArray(grupoActual.horario) &&
                    grupoActual.horario.length > 0 ? (
                      <ul className="profe-list">
                        {grupoActual.horario.map((h, idx) => (
                          <li key={idx} className="profe-listItem">
                            <span>
                              Aula <strong>{h.aula || "N/D"}</strong>
                            </span>
                            <span>
                              Día {h.dia} · {h.inicio} – {h.fin}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="profe-info">
                        Este grupo no tiene horario registrado.
                      </p>
                    )}
                  </div>

                  {/* Alumnos */}
                  <div className="profe-block">
                    <h3 className="profe-subsectionTitle">
                      Alumnos matriculados
                    </h3>

                    {loadingAlumnos && (
                      <p className="profe-info">Cargando alumnos...</p>
                    )}

                    {!loadingAlumnos && alumnos.length === 0 && (
                      <p className="profe-info">
                        No hay alumnos matriculados en este grupo.
                      </p>
                    )}

                    {!loadingAlumnos && alumnos.length > 0 && (
                      <ul className="profe-list">
                        {alumnos.map((al) => (
                          <li key={al.id} className="profe-listItem">
                            <div className="profe-listMain">
                              <strong>{al.nombre}</strong>
                              <span className="profe-listSecondary">
                                {al.email}
                              </span>
                            </div>
                            {al.documento && (
                              <span className="profe-chip">
                                Doc: {al.documento}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Materiales */}
                  <div className="profe-block">
                    <h3 className="profe-subsectionTitle">
                      Materiales publicados
                    </h3>

                    {loadingMateriales && (
                      <p className="profe-info">Cargando materiales...</p>
                    )}

                    {!loadingMateriales && materiales.length === 0 && (
                      <p className="profe-info">
                        No hay materiales publicados para este grupo.
                      </p>
                    )}

                    {!loadingMateriales && materiales.length > 0 && (
                      <ul className="profe-materialList">
                        {materiales.map((m) => (
                          <li key={m.id} className="profe-materialItem">
                            {editId === m.id ? (
                              <div className="profe-materialEdit">
                                <label className="profe-editField">
                                  <span>Título</span>
                                  <input
                                    type="text"
                                    value={editTitulo}
                                    onChange={(e) =>
                                      setEditTitulo(e.target.value)
                                    }
                                  />
                                </label>

                                <label className="profe-editField">
                                  <span>Descripción</span>
                                  <textarea
                                    value={editDescripcion}
                                    onChange={(e) =>
                                      setEditDescripcion(e.target.value)
                                    }
                                  />
                                </label>

                                <label className="profe-editField">
                                  <span>Enlace</span>
                                  <input
                                    type="url"
                                    value={editEnlace}
                                    onChange={(e) =>
                                      setEditEnlace(e.target.value)
                                    }
                                  />
                                </label>

                                <div className="profe-editActions">
                                  <button
                                    type="button"
                                    className="profe-btn profe-btn--primary"
                                    onClick={saveEdit}
                                    disabled={savingEdit}
                                  >
                                    {savingEdit ? "Guardando..." : "Guardar"}
                                  </button>
                                  <button
                                    type="button"
                                    className="profe-btn profe-btn--ghost"
                                    onClick={cancelEdit}
                                    disabled={savingEdit}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="profe-materialView">
                                <div className="profe-materialHeader">
                                  <div>
                                    <strong>{m.titulo}</strong>
                                    <small>{formatFecha(m.createdAt)}</small>
                                  </div>
                                </div>

                                {m.descripcion && (
                                  <p className="profe-materialDesc">
                                    {m.descripcion}
                                  </p>
                                )}

                                {m.archivoUrl && (
                                  <p className="profe-materialLink">
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
                                  <p className="profe-materialLink">
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

                                <div className="profe-editActions">
                                  <button
                                    type="button"
                                    className="profe-btn profe-btn--ghost"
                                    onClick={() => startEdit(m)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="profe-btn profe-btn--danger"
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
                  </div>

                  {/* Publicar nuevo material */}
                  <div className="profe-block">
                    <h3 className="profe-subsectionTitle">Publicar material</h3>
                    <div className="profe-formMaterial">
                      <FormMaterial
                        cursoId={grupoActual.cursoId}
                        grupoId={grupoActual.id}
                        onUploaded={(nuevo) =>
                          setMateriales((prev) => [nuevo, ...prev])
                        }
                      />
                    </div>
                  </div>

                  {/* Tareas del grupo */}
                  <div className="profe-block">
                    <h3 className="profe-subsectionTitle">Tareas del grupo</h3>

                    {loadingTareas && (
                      <p className="profe-info">Cargando tareas...</p>
                    )}

                    {!loadingTareas && tareas.length === 0 && (
                      <p className="profe-info">
                        Aún no hay tareas registradas para este grupo.
                      </p>
                    )}

                    {!loadingTareas && tareas.length > 0 && (
                      <ul className="profe-materialList">
                        {tareas.map((t) => (
                          <li key={t.id} className="profe-materialItem">
                            <div className="profe-materialHeader">
                              <div>
                                <strong>{t.titulo}</strong>
                                {t.fechaEntrega && (
                                  <small>
                                    Entrega: {formatFecha(t.fechaEntrega)}
                                  </small>
                                )}
                              </div>
                              <button
                                type="button"
                                className="profe-btn profe-btn--ghost"
                                onClick={() => toggleEntregas(t.id)}
                              >
                                {t.mostrarEntregas
                                  ? "Ocultar entregas"
                                  : "Ver entregas"}
                              </button>
                            </div>

                            {t.descripcion && (
                              <p className="profe-materialDesc">
                                {t.descripcion}
                              </p>
                            )}

                            {t.mostrarEntregas && (
                              <div className="profe-block">
                                {t.cargandoEntregas ? (
                                  <p className="profe-info">
                                    Cargando entregas...
                                  </p>
                                ) : t.entregas && t.entregas.length > 0 ? (
                                  <ul className="profe-list">
                                    {t.entregas.map((e) => (
                                      <li
                                        key={e.id}
                                        className="profe-listItem"
                                      >
                                        <div className="profe-listMain">
                                          <strong>
                                            {e.alumnoNombre ||
                                              e.alumnoEmail ||
                                              "Estudiante"}
                                          </strong>
                                          <span className="profe-listSecondary">
                                            {e.alumnoEmail}{" "}
                                            {e.fechaEntrega &&
                                              `· ${formatFecha(
                                                e.fechaEntrega
                                              )}`}
                                          </span>
                                        </div>

                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 4,
                                            alignItems: "flex-end",
                                          }}
                                        >
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={
                                              notaEdit[e.id] ??
                                              (e.nota ?? "")
                                            }
                                            onChange={(ev) =>
                                              setNotaEdit((prev) => ({
                                                ...prev,
                                                [e.id]: ev.target.value,
                                              }))
                                            }
                                            style={{
                                              width: 72,
                                              fontSize: "0.8rem",
                                            }}
                                          />
                                          <textarea
                                            value={
                                              comentarioEdit[e.id] ??
                                              (e.comentario ?? "")
                                            }
                                            onChange={(ev) =>
                                              setComentarioEdit((prev) => ({
                                                ...prev,
                                                [e.id]: ev.target.value,
                                              }))
                                            }
                                            style={{
                                              width: 190,
                                              fontSize: "0.78rem",
                                              minHeight: 50,
                                            }}
                                          />
                                          <button
                                            type="button"
                                            className="profe-btn profe-btn--primary"
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
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="profe-info">
                                    Aún no hay entregas para esta tarea.
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
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
