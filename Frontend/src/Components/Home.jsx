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
      return;
    }

    const filtrados = gruposProfe.filter((g) => g.cursoId === cursoSel);
    setGruposFiltrados(filtrados);
    setGrupoSel("");
    setGrupoActual(null);
    setAlumnos([]);
    setMateriales([]);
  }, [cursoSel, gruposProfe]);

  // 4) Al cambiar de grupo, cargar alumnos y materiales
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
    <div className="profe-page">
      <div className="profe-overlay" />

      <div className="profe-frame">
        {/* HEADER */}
        <header className="profe-header glass-strong">
          <div>
            <h1 className="profe-title">
              Hola, {user.nombre || "profesor"}
            </h1>
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
              {/* Selecciones */}
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
                    <h3 className="profe-subsectionTitle">
                      Horario y aulas
                    </h3>
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
                                    <small>
                                      {formatFecha(m.createdAt)}
                                    </small>
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

                    {/* Formulario para publicar nuevo material */}
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
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
