// src/Components/AdminCursos.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "../api/axios"; // <- el axios que mostraste

export default function AdminCursos() {
  const [form, setForm] = useState({
    nombre: "",
    grado: "",
    seccion: "",
    anio: new Date().getFullYear(),
  });

  const [cursos, setCursos] = useState([]);
  const [usuarios, setUsuarios] = useState([]); // catálogo para enriquecer alumnos
  const [loading, setLoading] = useState(false);

  // UI expand/collapse por curso y cache de alumnos
  const [open, setOpen] = useState({}); // { [cursoId]: boolean }
  const [alumnosPorCurso, setAlumnosPorCurso] = useState({}); // { [cursoId]: {loading, error, list: [{...}] } }

  // ------------ Loaders base ------------
  const loadCursos = async () => {
    try {
      const { data } = await api.get("/api/cursos"); // listar cursos
      console.log("GET /api/cursos ->", data);
      setCursos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(
        "Error loadCursos",
        e?.response?.status,
        e?.response?.data,
        e
      );
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
      console.error(
        "Error loadUsuarios",
        e?.response?.status,
        e?.response?.data,
        e
      );
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
      const { data } = await api.post("/api/cursos", payload); // crear curso
      console.log("Curso creado:", data);
      setForm({
        nombre: "",
        grado: "",
        seccion: "",
        anio: new Date().getFullYear(),
      });
      await loadCursos();
    } catch (e) {
      console.error(
        "Error createCurso",
        e?.response?.status,
        e?.response?.data,
        e
      );
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

  // Obtiene alumnos de TODOS los grupos del curso
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
      // 1) Grupos del curso
      const { data: grupos } = await api.get("/api/grupos");
      const gruposCurso = (Array.isArray(grupos) ? grupos : []).filter(
        (g) => g.cursoId === cursoId
      );

      // 2) Por cada grupo, pedimos alumnos (endpoint devuelve matrículas o usuarios)
      const items = [];
      for (const g of gruposCurso) {
        try {
          const { data } = await api.get(`/api/grupos/${g.id}/alumnos`);
          const arr = Array.isArray(data) ? data : [];

          // Si devolviera usuarios directamente:
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
            // Asumimos que son matrículas: { id: matriculaId, alumnoId, ... }
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
          // sigue con otros grupos
        }
      }

      // Orden por nombre
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

  // ------------ Eliminar alumno del curso (borrar matrícula) ------------
  async function eliminarDeCurso(cursoId, item) {
    try {
      let matriculaId = item.matriculaId;

      if (!matriculaId) {
        // Buscar matrícula por grupoId + alumnoId
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
    <div style={{ padding: 16 }}>
      <h2>Cursos (ADMIN)</h2>

      <form
        onSubmit={createCurso}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          margin: "12px 0",
        }}
      >
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) =>
            setForm((f) => ({ ...f, nombre: e.target.value }))
          }
        />
        <input
          placeholder="Grado (opcional)"
          value={form.grado}
          onChange={(e) =>
            setForm((f) => ({ ...f, grado: e.target.value }))
          }
        />
        <input
          placeholder="Sección (A/B/C o Mañana/Tarde, opcional)"
          value={form.seccion}
          onChange={(e) =>
            setForm((f) => ({ ...f, seccion: e.target.value }))
          }
        />
        <input
          type="number"
          placeholder="Año"
          value={form.anio}
          onChange={(e) =>
            setForm((f) => ({ ...f, anio: Number(e.target.value) }))
          }
        />
        <button type="submit">Crear</button>
      </form>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Nombre</th>
              <th style={{ textAlign: "left", padding: 8 }}>Grado</th>
              <th style={{ textAlign: "left", padding: 8 }}>Sección</th>
              <th style={{ textAlign: "left", padding: 8 }}>Año</th>
              <th style={{ textAlign: "left", padding: 8 }}>Alumnos</th>
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
                    <td style={{ padding: 8 }}>{c.nombre}</td>
                    <td style={{ padding: 8 }}>{c.grado || "-"}</td>
                    <td style={{ padding: 8 }}>{c.seccion || "-"}</td>
                    <td style={{ padding: 8 }}>{c.anio}</td>
                    <td style={{ padding: 8 }}>
                      <button
                        type="button"
                        onClick={() => toggleCurso(c.id)}
                        style={{ marginRight: 8 }}
                      >
                        {abierto ? "Ocultar" : "Ver"} alumnos
                      </button>
                      {box.list?.length ? (
                        <small>{box.list.length} en total</small>
                      ) : null}
                    </td>
                  </tr>
                  {abierto && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ background: "#fafafa", padding: 8 }}
                      >
                        {box.loading ? (
                          <div>Cargando alumnos…</div>
                        ) : box.error ? (
                          <div style={{ color: "crimson" }}>{box.error}</div>
                        ) : box.list.length ? (
                          <table
                            style={{ width: "100%", borderCollapse: "collapse" }}
                          >
                            <thead>
                              <tr>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: 6,
                                  }}
                                >
                                  Nombre
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: 6,
                                  }}
                                >
                                  Email
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: 6,
                                  }}
                                >
                                  Documento
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: 6,
                                  }}
                                >
                                  Grupo
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: 6,
                                  }}
                                >
                                  Acciones
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {box.list.map((al, idx) => (
                                <tr
                                  key={`${al.alumnoId}-${al.grupoId}-${idx}`}
                                  style={{ borderTop: "1px solid #eee" }}
                                >
                                  <td style={{ padding: 6 }}>
                                    {al.nombreVista}
                                  </td>
                                  <td style={{ padding: 6 }}>{al.email}</td>
                                  <td style={{ padding: 6 }}>
                                    {al.documento}
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    {al.grupoNombre || al.grupoId}
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <button
                                      type="button"
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
                          <div>
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
                <td colSpan={5} style={{ padding: 8 }}>
                  Sin cursos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
