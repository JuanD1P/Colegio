// src/Components/AdminCursos.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import logo from "../ImagenesP/ImagenesLogin/ADMINLOGO.png";

import "./DOCSS/Admin.css";
import "./DOCSS/AdminCursos.css";

export default function AdminCursos() {
  const [form, setForm] = useState({
    nombre: "",
    grado: "",
    seccion: "",
    anio: new Date().getFullYear(),
  });

  const [cursos, setCursos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState({});
  const [alumnosPorCurso, setAlumnosPorCurso] = useState({});

  const navigate = useNavigate();

  // ------------ Loaders base ------------
  const loadCursos = async () => {
    try {
      const { data } = await api.get("/api/cursos");
      setCursos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loadCursos", e?.response?.status, e?.response?.data, e);
      setCursos([]);
    }
  };

  const loadUsuarios = async () => {
    try {
      const { data } = await api.get("/api/usuarios");
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a, b) =>
        String(a.email || "").localeCompare(String(b.email || ""))
      );
      setUsuarios(arr);
    } catch (e) {
      console.error("Error loadUsuarios", e?.response?.status, e?.response?.data, e);
      setUsuarios([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCursos(), loadUsuarios()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ------------ Crear curso ------------
  const createCurso = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.anio) return;

    try {
      const payload = {
        ...form,
        anio: Number(form.anio),
      };
      await api.post("/api/cursos", payload);
      setForm({
        nombre: "",
        grado: "",
        seccion: "",
        anio: new Date().getFullYear(),
      });
      await loadCursos();
    } catch (e) {
      console.error("Error createCurso", e?.response?.status, e?.response?.data, e);
      alert(e?.response?.data?.error || "No se pudo crear el curso");
    }
  };

  // ------------ Helpers alumnos ------------
  const byUserId = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u])),
    [usuarios]
  );

  function normalizeUser(u) {
    if (!u) return { nombreVista: "(sin nombre)", email: "—", documento: "—" };
    const nombre =
      u.nombre ||
      u.nombre_completo ||
      `${u.nombres || ""} ${u.apellidos || ""}`.trim() ||
      "(sin nombre)";
    return {
      nombreVista: nombre,
      email: u.email || u.correo || "—",
      documento: u.documento || u.numDoc || u.doc || "—",
    };
  }

  async function fetchAlumnosCurso(cursoId) {
    setAlumnosPorCurso((prev) => ({
      ...prev,
      [cursoId]: {
        loading: true,
        error: "",
        list: prev[cursoId]?.list || [],
      },
    }));

    try {
      const { data: grupos } = await api.get("/api/grupos");
      const gruposCurso = (Array.isArray(grupos) ? grupos : []).filter(
        (g) => g.cursoId === cursoId
      );

      const items = [];
      for (const g of gruposCurso) {
        try {
          const { data } = await api.get(`/api/grupos/${g.id}/alumnos`);
          const arr = Array.isArray(data) ? data : [];

          const esUsuario =
            arr[0] && (arr[0].email || arr[0].nombres || arr[0].nombre);
          if (esUsuario) {
            arr.forEach((u) => {
              const n = normalizeUser(u);
              items.push({
                ...n,
                alumnoId: u.id || u.uid,
                grupoId: g.id,
                grupoNombre: g.nombre,
                matriculaId: null,
              });
            });
          } else {
            arr.forEach((m) => {
              const u = byUserId.get(m.alumnoId) || null;
              const n = normalizeUser(u);
              items.push({
                ...n,
                alumnoId: m.alumnoId,
                grupoId: g.id,
                grupoNombre: g.nombre,
                matriculaId: m.id,
              });
            });
          }
        } catch (e) {
          console.error(
            `Error cargando alumnos de grupo ${g.id}`,
            e?.response?.status,
            e?.response?.data
          );
        }
      }

      items.sort((a, b) =>
        String(a.nombreVista).localeCompare(String(b.nombreVista))
      );

      setAlumnosPorCurso((prev) => ({
        ...prev,
        [cursoId]: { loading: false, error: "", list: items },
      }));
    } catch (e) {
      console.error("Error fetchAlumnosCurso", e);
      setAlumnosPorCurso((prev) => ({
        ...prev,
        [cursoId]: {
          loading: false,
          error: "No se pudo cargar alumnos",
          list: [],
        },
      }));
    }
  }

  async function toggleCurso(cursoId) {
    setOpen((prev) => {
      const next = !prev[cursoId];
      if (next && !alumnosPorCurso[cursoId]?.list?.length) {
        fetchAlumnosCurso(cursoId);
      }
      return { ...prev, [cursoId]: next };
    });
  }

  async function eliminarDeCurso(cursoId, item) {
    try {
      let matriculaId = item.matriculaId;

      if (!matriculaId) {
        const { data } = await api.get(`/api/grupos/${item.grupoId}/alumnos`);
        const mats = (Array.isArray(data) ? data : []).filter(
          (m) => m.alumnoId === item.alumnoId
        );
        if (mats[0]?.id) matriculaId = mats[0].id;
      }

      if (!matriculaId) {
        alert("No se encontró la matrícula para eliminar.");
        return;
      }

      await api.delete(`/api/matriculas/${matriculaId}`);
      await fetchAlumnosCurso(cursoId);
      alert("Alumno eliminado del curso");
    } catch (e) {
      console.error("Error eliminarDeCurso", e);
      alert(e?.response?.data?.error || "No se pudo eliminar la matrícula");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-overlay" />

      {/* HEADER */}
      <header className="admin-header glass-strong">
        <div className="admin-header-left">
          <img src={logo} alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">Gestión de cursos</h1>
            <p className="admin-subtitle">
              Crea cursos y revisa los alumnos inscritos
            </p>
          </div>
        </div>

        <div className="admin-header-actions">
          <button className="btn" type="button" onClick={loadAll}>
            Actualizar
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => navigate("/admin")}
          >
            Volver al panel
          </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="admin-content">
        <section className="card glass-strong adminCursos-card">
          {/* FORMULARIO */}
          <form onSubmit={createCurso} className="adminCursos-form">
            <input
              className="adminCursos-input"
              placeholder="Nombre del curso"
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
            />
            <input
              className="adminCursos-input"
              placeholder="Grado (opcional)"
              value={form.grado}
              onChange={(e) =>
                setForm((f) => ({ ...f, grado: e.target.value }))
              }
            />
            <input
              className="adminCursos-input"
              placeholder="Sección (A/B/C o Mañana/Tarde)"
              value={form.seccion}
              onChange={(e) =>
                setForm((f) => ({ ...f, seccion: e.target.value }))
              }
            />
            <input
              className="adminCursos-input adminCursos-input--year"
              type="number"
              placeholder="Año"
              value={form.anio}
              onChange={(e) =>
                setForm((f) => ({ ...f, anio: Number(e.target.value) }))
              }
            />

            <button type="submit" className="btn accent adminCursos-submit">
              Crear curso
            </button>
          </form>

          {/* LISTA DE CURSOS */}
          {loading ? (
            <p className="adminCursos-loading">Cargando…</p>
          ) : (
            <div className="table-scroll">
              <table className="admin-table adminCursos-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Grado</th>
                    <th>Sección</th>
                    <th>Año</th>
                    <th>Alumnos</th>
                  </tr>
                </thead>
                <tbody>
                  {cursos.map((c) => {
                    const box = alumnosPorCurso[c.id] || {
                      loading: false,
                      error: "",
                      list: [],
                    };
                    const abierto = !!open[c.id];

                    return (
                      <React.Fragment key={c.id}>
                        <tr>
                          <td className="cell-strong">{c.nombre}</td>
                          <td>{c.grado || "-"}</td>
                          <td>{c.seccion || "-"}</td>
                          <td>{c.anio}</td>
                          <td>
                            <button
                              type="button"
                              className="btn adminCursos-toggle"
                              onClick={() => toggleCurso(c.id)}
                            >
                              {abierto ? "Ocultar alumnos" : "Ver alumnos"}
                            </button>
                            {box.list?.length ? (
                              <small className="adminCursos-count">
                                {box.list.length} en total
                              </small>
                            ) : null}
                          </td>
                        </tr>

                        {abierto && (
                          <tr>
                            <td colSpan={5} className="adminCursos-subrow">
                              {box.loading ? (
                                <div className="adminCursos-subloading">
                                  Cargando alumnos…
                                </div>
                              ) : box.error ? (
                                <div className="adminCursos-suberror">
                                  {box.error}
                                </div>
                              ) : box.list.length ? (
                                <table className="adminCursos-subtable">
                                  <thead>
                                    <tr>
                                      <th>Nombre</th>
                                      <th>Email</th>
                                      <th>Documento</th>
                                      <th>Grupo</th>
                                      <th>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {box.list.map((al, idx) => (
                                      <tr
                                        key={`${al.alumnoId}-${al.grupoId}-${idx}`}
                                      >
                                        <td>{al.nombreVista}</td>
                                        <td>{al.email}</td>
                                        <td>{al.documento}</td>
                                        <td>{al.grupoNombre || al.grupoId}</td>
                                        <td>
                                          <button
                                            type="button"
                                            className="btn danger adminCursos-remove"
                                            onClick={() =>
                                              eliminarDeCurso(c.id, al)
                                            }
                                          >
                                            Eliminar
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="adminCursos-subempty">
                                  No hay alumnos en los grupos de este curso.
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {!cursos.length && (
                    <tr>
                      <td colSpan={5} className="cell-empty">
                        Sin cursos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
