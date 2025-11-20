import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

import logo from "../ImagenesP/ImagenesLogin/ADMINLOGO.png";
import "./DOCSS/Admin.css";
import "./DOCSS/AdminGrupos.css";

export default function Grupos() {
  const [cursos, setCursos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);

  // selección para crear grupo
  const [cursoId, setCursoId] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [profesorId, setProfesorId] = useState("");

  // alumnos para matricular
  const [busca, setBusca] = useState("");
  const [alumnoSel, setAlumnoSel] = useState("");

  // seleccionar grupo para matricular
  const [grupoMatricula, setGrupoMatricula] = useState("");

  const [loading, setLoading] = useState(false);

  // UI: ver alumnos matriculados por grupo
  const [expandidos, setExpandidos] = useState({});
  const [alumnosPorGrupo, setAlumnosPorGrupo] = useState({});

  // Horario: borrador por grupo
  const [nuevoHorario, setNuevoHorario] = useState({});

  const navigate = useNavigate();

  /* ===================== HELPERS ===================== */

  function formatCurso(curso) {
    if (!curso) return "";
    const partes = [curso.nombre];
    if (curso.grado) partes.push(curso.grado);
    let txt = partes.join(" ");
    if (curso.seccion) txt += ` - ${curso.seccion}`;
    if (curso.anio) txt += ` • ${curso.anio}`;
    return txt;
  }

  function diaToTexto(dia) {
    const map = {
      1: "Lunes",
      2: "Martes",
      3: "Miércoles",
      4: "Jueves",
      5: "Viernes",
      6: "Sábado",
      7: "Domingo",
    };
    return map[dia] || dia;
  }

  /* ===================== LOADERS ===================== */

  useEffect(() => {
    (async () => {
      await Promise.all([loadCursos(), loadUsuarios(), loadGrupos()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCursos() {
    try {
      const { data } = await api.get("/api/cursos");
      const arr = Array.isArray(data) ? data : [];
      setCursos(arr);
      if (!cursoId && arr.length) setCursoId(arr[0].id);
    } catch (e) {
      console.error("loadCursos", e);
    }
  }

  async function loadGrupos() {
    try {
      const { data } = await api.get("/api/grupos");
      const arr = Array.isArray(data) ? data : [];
      setGrupos(arr);
      if (!grupoMatricula && arr.length) setGrupoMatricula(arr[0].id);
    } catch (e) {
      console.error("loadGrupos", e);
    }
  }

  async function loadUsuarios() {
    try {
      const { data } = await api.get("/api/usuarios");
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a, b) =>
        String(a.email || "").localeCompare(String(b.email || ""))
      );
      setAlumnos(arr);

      // alumnoSel por defecto
      const est = arr.find(
        (u) =>
          String(u.rol || "").toUpperCase() === "ESTUDIANTE" &&
          (u.estado || "activo") === "activo" &&
          (u.perfilCompleto === undefined ? true : !!u.perfilCompleto)
      );
      if (!alumnoSel && est) setAlumnoSel(est.id);
    } catch (e) {
      console.error("loadUsuarios", e);
    }
  }

  /* ===================== MEMOS ===================== */

  const cursoSeleccionado = useMemo(
    () => cursos.find((c) => c.id === cursoId) || null,
    [cursos, cursoId]
  );

  const nombreSugerido = useMemo(() => {
    if (!cursoSeleccionado) return "Grupo único";
    if (cursoSeleccionado.seccion) return cursoSeleccionado.seccion;
    return "Grupo único";
  }, [cursoSeleccionado]);

  const alumnosEstudiantes = useMemo(
    () =>
      alumnos.filter((u) => {
        const rolOk = (u.rol || "").toUpperCase() === "ESTUDIANTE";
        const estOk = (u.estado || "activo") === "activo";
        const perfOk =
          u.perfilCompleto === undefined ? true : !!u.perfilCompleto;
        return rolOk && estOk && perfOk;
      }),
    [alumnos]
  );

  const alumnosFiltrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const base = alumnosEstudiantes;
    if (!s) return base;
    return base.filter((u) =>
      [
        u.email,
        u.nombre,
        u.nombre_completo,
        u.nombres,
        u.apellidos,
        u.documento,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [alumnosEstudiantes, busca]);

  const cursosById = useMemo(
    () => new Map(cursos.map((c) => [c.id, c])),
    [cursos]
  );

  const profesById = useMemo(
    () =>
      new Map(
        alumnos
          .filter((u) => (u.rol || "").toUpperCase() === "PROFESOR")
          .map((p) => [
            p.id,
            {
              id: p.id,
              nombre: p.nombre || p.nombres || "(Profe)",
              email: p.email || "",
            },
          ])
      ),
    [alumnos]
  );

  const listaProfes = useMemo(
    () => Array.from(profesById.values()),
    [profesById]
  );

  useEffect(() => {
    if (!profesorId && listaProfes.length) {
      setProfesorId(listaProfes[0].id);
    }
  }, [listaProfes, profesorId]);

  /* ===================== ACCIONES ===================== */

  async function crearGrupo() {
    if (!cursoId || !profesorId) return;
    setLoading(true);
    try {
      const nombreFinal = (nombreGrupo || "").trim() || nombreSugerido;
      await api.post("/api/grupos", {
        cursoId,
        nombre: nombreFinal,
        profesorId,
      });
      setNombreGrupo("");
      await loadGrupos();
      alert("Grupo creado");
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo crear el grupo");
    } finally {
      setLoading(false);
    }
  }

  async function matricular() {
    if (!grupoMatricula || !alumnoSel) return;
    setLoading(true);
    try {
      await api.post("/api/matriculas", {
        grupoId: grupoMatricula,
        alumnoId: alumnoSel,
      });
      alert("Alumno matriculado");
      if (expandidos[grupoMatricula]) {
        await fetchAlumnosGrupo(grupoMatricula, true);
      }
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo matricular");
    } finally {
      setLoading(false);
    }
  }

  /* ===================== JOIN MATRÍCULAS -> USUARIOS ===================== */

  function isUserLike(x) {
    return !!(
      x &&
      (x.email || x.nombre || x.nombre_completo || x.nombres || x.apellidos)
    );
  }

  function userFromMatricula(m, byId) {
    if (m.alumno && typeof m.alumno === "object") return m.alumno;

    if (typeof m.alumno === "string") {
      const u = byId.get(m.alumno);
      return (
        u || {
          id: m.alumno,
          email: m.alumnoEmail || m.email || "",
          documento: m.documento || m.numDoc || "",
        }
      );
    }

    const id =
      m.alumnoId ||
      m.estudianteId ||
      m.userId ||
      m.uid ||
      m.idAlumno ||
      m.id;

    if (id) {
      const u = byId.get(id);
      return (
        u || {
          id,
          email: m.alumnoEmail || m.email || "",
          documento: m.documento || m.numDoc || "",
        }
      );
    }

    return { id: m.id || Math.random().toString(36).slice(2) };
  }

  /* ===================== CARGA DE ALUMNOS POR GRUPO ===================== */

  function setGrupoState(grupoId, patch) {
    setAlumnosPorGrupo((prev) => ({
      ...prev,
      [grupoId]: {
        list: [],
        loading: false,
        error: "",
        ...(prev[grupoId] || {}),
        ...patch,
      },
    }));
  }

  async function fetchAlumnosGrupo(grupoId, force = false) {
    const g = grupos.find((x) => x.id === grupoId);
    if (!force && g && Array.isArray(g.alumnos) && g.alumnos.length) {
      setGrupoState(grupoId, { list: g.alumnos, loading: false, error: "" });
      return;
    }

    try {
      setGrupoState(grupoId, { loading: true, error: "" });

      const byId = new Map(alumnos.map((u) => [u.id, u]));
      let lista = [];

      try {
        const { data } = await api.get(`/api/grupos/${grupoId}/alumnos`);
        if (Array.isArray(data)) {
          if (data.length && isUserLike(data[0])) {
            lista = data;
          } else {
            lista = data.map((m) => userFromMatricula(m, byId));
          }
        }
      } catch (_) {}

      if (!lista.length) {
        try {
          const { data } = await api.get("/api/matriculas", {
            params: { grupoId },
          });
          const arr = Array.isArray(data) ? data : [];
          lista = arr.map((m) => userFromMatricula(m, byId));
        } catch (__) {}
      }

      lista.sort((a, b) =>
        String(
          a.nombre ||
            a.nombre_completo ||
            `${a.nombres || ""} ${a.apellidos || ""}`.trim() ||
            a.email ||
            ""
        ).localeCompare(
          String(
            b.nombre ||
              b.nombre_completo ||
              `${b.nombres || ""} ${b.apellidos || ""}`.trim() ||
              b.email ||
              ""
          )
        )
      );

      setGrupoState(grupoId, { list: lista, loading: false, error: "" });
    } catch (e) {
      setGrupoState(grupoId, {
        loading: false,
        error:
          e?.response?.data?.error || "No se pudo cargar alumnos",
      });
    }
  }

  async function toggleExpand(grupoId) {
    setExpandidos((prev) => {
      const nextOpen = !prev[grupoId];
      if (nextOpen && !(alumnosPorGrupo[grupoId]?.list?.length)) {
        fetchAlumnosGrupo(grupoId);
      }
      return { ...prev, [grupoId]: nextOpen };
    });
  }

  /* ===================== HORARIO POR GRUPO ===================== */

  function onChangeNuevoHorario(grupoId, campo, valor) {
    setNuevoHorario((prev) => ({
      ...prev,
      [grupoId]: {
        dia: 1,
        aula: "",
        inicio: "07:00",
        fin: "08:00",
        ...(prev[grupoId] || {}),
        [campo]: valor,
      },
    }));
  }

  async function agregarHorario(grupoId) {
    const g = grupos.find((x) => x.id === grupoId);
    if (!g) return;

    const draft = nuevoHorario[grupoId] || {};
    const entrada = {
      dia: Number(draft.dia) || 1,
      aula: (draft.aula || "").trim(),
      inicio: (draft.inicio || "").trim(),
      fin: (draft.fin || "").trim(),
    };

    if (!entrada.aula || !entrada.inicio || !entrada.fin) {
      alert("Completa aula, inicio y fin");
      return;
    }

    const horarioActual = Array.isArray(g.horario) ? g.horario : [];
    const horarioNuevo = [...horarioActual, entrada];

    setLoading(true);
    try {
      await api.put(`/api/grupos/${grupoId}`, { horario: horarioNuevo });
      await loadGrupos();
      setNuevoHorario((prev) => ({
        ...prev,
        [grupoId]: { dia: 1, aula: "", inicio: "07:00", fin: "08:00" },
      }));
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo guardar el horario");
    } finally {
      setLoading(false);
    }
  }

  /* ===================== UI ===================== */

  return (
    <div className="admin-page">
      <div className="admin-overlay" />

      {/* HEADER */}
      <header className="admin-header glass-strong">
        <div className="admin-header-left">
          <img src={logo} alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">Gestión de grupos</h1>
            <p className="admin-subtitle">
              Crea grupos, matricula estudiantes y define horarios
            </p>
          </div>
        </div>

        <div className="admin-header-actions">
          <button className="btn" type="button" onClick={() => {
            loadCursos();
            loadGrupos();
            loadUsuarios();
          }}>
            Actualizar
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => navigate("/admin/cursos")}
          >
            Ir a cursos
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
        <section className="card glass-strong adminGrupos-card">
          {/* CREAR Y MATRICULAR */}
          <div className="adminGrupos-top">
            {/* Crear grupo */}
            <section className="adminGrupos-block">
              <h2 className="adminGrupos-blockTitle">Crear grupo</h2>
              <form
                className="adminGrupos-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  crearGrupo();
                }}
              >
                <select
                  className="adminGrupos-select"
                  value={cursoId}
                  onChange={(e) => setCursoId(e.target.value)}
                >
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCurso(c)}
                    </option>
                  ))}
                </select>

                <input
                  className="adminGrupos-input"
                  placeholder={`Nombre del grupo (ej. "${nombreSugerido}")`}
                  value={nombreGrupo}
                  onChange={(e) => setNombreGrupo(e.target.value)}
                />

                <select
                  className="adminGrupos-select"
                  value={profesorId}
                  onChange={(e) => setProfesorId(e.target.value)}
                >
                  {listaProfes.length ? (
                    listaProfes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.email ? `(${p.email})` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">(Sin profesores)</option>
                  )}
                </select>

                <button
                  type="submit"
                  className="btn accent adminGrupos-submit"
                  disabled={loading || !cursoId || !profesorId}
                >
                  {loading ? "Creando..." : "Crear grupo"}
                </button>
              </form>
              <p className="adminGrupos-help">
                Si no escribes un nombre, se usará:{" "}
                <span>{nombreSugerido}</span>.
              </p>
            </section>

            {/* Matricular alumno */}
            <section className="adminGrupos-block">
              <h2 className="adminGrupos-blockTitle">Matricular alumno</h2>
              <div className="adminGrupos-form">
                <select
                  className="adminGrupos-select"
                  value={grupoMatricula}
                  onChange={(e) => setGrupoMatricula(e.target.value)}
                  disabled={!grupos.length}
                >
                  {grupos.length ? (
                    grupos.map((g) => {
                      const curso = cursosById.get(g.cursoId);
                      return (
                        <option key={g.id} value={g.id}>
                          {g.nombre} •{" "}
                          {curso ? formatCurso(curso) : g.cursoNombre || g.cursoId}
                        </option>
                      );
                    })
                  ) : (
                    <option value="">(No hay grupos)</option>
                  )}
                </select>

                <input
                  className="adminGrupos-input"
                  placeholder="Buscar alumno (nombre/email/documento)"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />

                <select
                  className="adminGrupos-select"
                  value={alumnoSel}
                  onChange={(e) => setAlumnoSel(e.target.value)}
                  disabled={!alumnosFiltrados.length}
                >
                  {alumnosFiltrados.length ? (
                    alumnosFiltrados.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(
                          a.nombre ||
                          a.nombre_completo ||
                          `${a.nombres || ""} ${a.apellidos || ""}`.trim() ||
                          "(sin nombre)"
                        )}{" "}
                        — {a.email}
                      </option>
                    ))
                  ) : (
                    <option value="">(Sin coincidencias)</option>
                  )}
                </select>

                <button
                  type="button"
                  className="btn accent adminGrupos-submit"
                  onClick={matricular}
                  disabled={!grupos.length || !alumnoSel || loading}
                >
                  {loading ? "Matriculando..." : "Matricular"}
                </button>
              </div>
              <p className="adminGrupos-help">
                Solo se muestran <b>ESTUDIANTES</b> activos (y, si existe,
                con <code>perfilCompleto</code> en true).
              </p>
            </section>
          </div>

          {/* LISTADO DE GRUPOS */}
          <section className="adminGrupos-list">
            <h2 className="adminGrupos-blockTitle">Listado de grupos</h2>

            {!grupos.length ? (
              <div className="cell-empty">Sin grupos</div>
            ) : (
              <div className="table-scroll">
                <table className="admin-table adminGrupos-table">
                  <thead>
                    <tr>
                      <th>Grupo</th>
                      <th>Curso</th>
                      <th>Profesor</th>
                      <th>Estudiantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => {
                      const info = alumnosPorGrupo[g.id] || {
                        list: [],
                        loading: false,
                        error: "",
                      };
                      const abierto = !!expandidos[g.id];
                      const contador = Array.isArray(g.alumnos)
                        ? g.alumnos.length
                        : info.list.length;
                      const listaRender = info.list.length
                        ? info.list
                        : g.alumnos;

                      const curso = cursosById.get(g.cursoId);
                      const prof = profesById.get(g.profesorId);
                      const horario = Array.isArray(g.horario) ? g.horario : [];

                      const draft = nuevoHorario[g.id] || {
                        dia: 1,
                        aula: "",
                        inicio: "07:00",
                        fin: "08:00",
                      };

                      return (
                        <React.Fragment key={g.id}>
                          <tr>
                            <td className="cell-strong">{g.nombre}</td>
                            <td>
                              {curso
                                ? formatCurso(curso)
                                : g.cursoNombre || g.cursoId || "—"}
                            </td>
                            <td>
                              {prof
                                ? `${prof.nombre}${
                                    prof.email ? ` (${prof.email})` : ""
                                  }`
                                : g.profesorId || "—"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn adminGrupos-toggle"
                                onClick={() => toggleExpand(g.id)}
                              >
                                {abierto ? "Ocultar alumnos" : "Ver alumnos"}
                              </button>
                              <small className="adminGrupos-count">
                                {Number.isFinite(contador)
                                  ? `${contador} en total`
                                  : ""}
                              </small>
                            </td>
                          </tr>

                          {abierto && (
                            <tr>
                              <td colSpan={4} className="adminGrupos-subrow">
                                {/* ALUMNOS */}
                                <h3 className="adminGrupos-subtitle">
                                  Estudiantes del grupo
                                </h3>
                                {info.loading ? (
                                  <div className="adminGrupos-subloading">
                                    Cargando alumnos...
                                  </div>
                                ) : info.error ? (
                                  <div className="adminGrupos-suberror">
                                    {info.error}
                                  </div>
                                ) : listaRender && listaRender.length ? (
                                  <table className="adminGrupos-subtable">
                                    <thead>
                                      <tr>
                                        <th>Nombre</th>
                                        <th>Email</th>
                                        <th>Documento</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {listaRender.map((al, idx) => (
                                        <tr key={al.id || al.uid || idx}>
                                          <td>
                                            {al.nombre ||
                                              al.nombre_completo ||
                                              `${al.nombres || ""} ${
                                                al.apellidos || ""
                                              }`.trim() ||
                                              "(sin nombre)"}
                                          </td>
                                          <td>{al.email || al.correo || "—"}</td>
                                          <td>
                                            {al.documento ||
                                              al.numDoc ||
                                              al.doc ||
                                              "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="adminGrupos-subempty">
                                    No hay estudiantes matriculados todavía.
                                  </div>
                                )}

                                {/* HORARIO */}
                                <h3 className="adminGrupos-subtitle">
                                  Horario del grupo
                                </h3>
                                {horario.length ? (
                                  <table className="adminGrupos-subtable">
                                    <thead>
                                      <tr>
                                        <th>Día</th>
                                        <th>Aula</th>
                                        <th>Inicio</th>
                                        <th>Fin</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {horario.map((h, i) => (
                                        <tr key={i}>
                                          <td>{diaToTexto(h.dia)}</td>
                                          <td>{h.aula}</td>
                                          <td>{h.inicio}</td>
                                          <td>{h.fin}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="adminGrupos-subempty">
                                    Sin horario definido.
                                  </div>
                                )}

                                {/* FORM HORARIO */}
                                <div className="adminGrupos-horarioForm">
                                  <select
                                    className="adminGrupos-select"
                                    value={draft.dia}
                                    onChange={(e) =>
                                      onChangeNuevoHorario(
                                        g.id,
                                        "dia",
                                        Number(e.target.value)
                                      )
                                    }
                                  >
                                    <option value={1}>Lunes</option>
                                    <option value={2}>Martes</option>
                                    <option value={3}>Miércoles</option>
                                    <option value={4}>Jueves</option>
                                    <option value={5}>Viernes</option>
                                    <option value={6}>Sábado</option>
                                    <option value={7}>Domingo</option>
                                  </select>

                                  <input
                                    className="adminGrupos-input adminGrupos-input--small"
                                    placeholder="Aula"
                                    value={draft.aula}
                                    onChange={(e) =>
                                      onChangeNuevoHorario(
                                        g.id,
                                        "aula",
                                        e.target.value
                                      )
                                    }
                                  />

                                  <input
                                    type="time"
                                    className="adminGrupos-input adminGrupos-input--time"
                                    value={draft.inicio}
                                    onChange={(e) =>
                                      onChangeNuevoHorario(
                                        g.id,
                                        "inicio",
                                        e.target.value
                                      )
                                    }
                                  />

                                  <input
                                    type="time"
                                    className="adminGrupos-input adminGrupos-input--time"
                                    value={draft.fin}
                                    onChange={(e) =>
                                      onChangeNuevoHorario(
                                        g.id,
                                        "fin",
                                        e.target.value
                                      )
                                    }
                                  />

                                  <button
                                    type="button"
                                    className="btn accent adminGrupos-horarioBtn"
                                    onClick={() => agregarHorario(g.id)}
                                    disabled={loading}
                                  >
                                    {loading ? "Guardando..." : "Agregar horario"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
