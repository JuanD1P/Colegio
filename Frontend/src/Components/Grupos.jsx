import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

export default function Grupos() {
  const [cursos, setCursos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [alumnos, setAlumnos] = useState([]); // todos los usuarios

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
  const [expandidos, setExpandidos] = useState({}); // { [grupoId]: true }
  const [alumnosPorGrupo, setAlumnosPorGrupo] = useState({}); // { [grupoId]: { list, loading, error } }

  // Horario: borrador por grupo
  const [nuevoHorario, setNuevoHorario] = useState({}); // { [grupoId]: { dia, aula, inicio, fin } }

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
      const { data } = await api.get("/api/grupos"); // admin: todos
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
          .filter(
            (u) => (u.rol || "").toUpperCase() === "PROFESOR"
          )
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

  // profesor por defecto para crear grupo
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
        } catch (__){ }
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
    <div
      className="page"
      style={{
        padding: 16,
        height: "calc(100vh - 120px)", // espacio para navbar + footer
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <h2>Grupos (ADMIN)</h2>

      {/* Crear grupo */}
      <section style={{ marginBottom: 24 }}>
        <h3>Crear grupo</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
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
            placeholder={`Nombre del grupo (opcional, p. ej. "${nombreSugerido}")`}
            value={nombreGrupo}
            onChange={(e) => setNombreGrupo(e.target.value)}
            style={{ minWidth: 220 }}
          />

          <select
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
            onClick={crearGrupo}
            disabled={loading || !cursoId || !profesorId}
          >
            {loading ? "Creando..." : "Crear grupo"}
          </button>
        </div>
        <small>
          Si no ingresas nombre, se usará: <b>{nombreSugerido}</b>
        </small>
      </section>

      {/* Matricular alumno */}
      <section style={{ marginBottom: 24 }}>
        <h3>Matricular alumno</h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select
            value={grupoMatricula}
            onChange={(e) => setGrupoMatricula(e.target.value)}
            disabled={!grupos.length}
            title="Grupo destino"
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
            placeholder="Buscar alumno (nombre/email/documento)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <select
            value={alumnoSel}
            onChange={(e) => setAlumnoSel(e.target.value)}
            disabled={!alumnosFiltrados.length}
            title="Alumno a matricular"
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
            onClick={matricular}
            disabled={!grupos.length || !alumnoSel || loading}
          >
            {loading ? "Matriculando..." : "Matricular"}
          </button>
        </div>
        <small>
          Se muestran solo <b>ESTUDIANTES</b> activos (y, si existe el campo,
          con <code>perfilCompleto</code>).
        </small>
      </section>

      {/* Listado de grupos */}
      <section>
        <h3>Listado de grupos</h3>
        {!grupos.length ? (
          <div>Sin grupos</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Grupo</th>
                <th style={{ textAlign: "left", padding: 8 }}>Curso</th>
                <th style={{ textAlign: "left", padding: 8 }}>Profesor</th>
                <th style={{ textAlign: "left", padding: 8 }}>Estudiantes</th>
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
                const listaRender = info.list.length ? info.list : g.alumnos;

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
                    <tr style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>{g.nombre}</td>
                      <td style={{ padding: 8 }}>
                        {curso
                          ? formatCurso(curso)
                          : g.cursoNombre || g.cursoId || "—"}
                      </td>
                      <td style={{ padding: 8 }}>
                        {prof
                          ? `${prof.nombre}${
                              prof.email ? ` (${prof.email})` : ""
                            }`
                          : g.profesorId || "—"}
                      </td>
                      <td style={{ padding: 8 }}>
                        <button
                          onClick={() => toggleExpand(g.id)}
                          style={{ marginRight: 8 }}
                        >
                          {abierto ? "Ocultar" : "Ver"} alumnos
                        </button>
                        <small>
                          {Number.isFinite(contador)
                            ? `${contador} en total`
                            : ""}
                        </small>
                      </td>
                    </tr>

                    {abierto && (
                      <tr>
                        <td
                          colSpan={4}
                          style={{ padding: 8, background: "#fafafa" }}
                        >
                          {/* ALUMNOS */}
                          <h4>Estudiantes del grupo</h4>
                          {info.loading ? (
                            <div>Cargando alumnos...</div>
                          ) : info.error ? (
                            <div style={{ color: "crimson" }}>
                              {info.error}
                            </div>
                          ) : listaRender && listaRender.length ? (
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                marginBottom: 12,
                              }}
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
                                </tr>
                              </thead>
                              <tbody>
                                {listaRender.map((al, idx) => (
                                  <tr
                                    key={al.id || al.uid || idx}
                                    style={{ borderTop: "1px solid #eee" }}
                                  >
                                    <td style={{ padding: 6 }}>
                                      {al.nombre ||
                                        al.nombre_completo ||
                                        `${al.nombres || ""} ${
                                          al.apellidos || ""
                                        }`.trim() ||
                                        "(sin nombre)"}
                                    </td>
                                    <td style={{ padding: 6 }}>
                                      {al.email || al.correo || "—"}
                                    </td>
                                    <td style={{ padding: 6 }}>
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
                            <div style={{ marginBottom: 12 }}>
                              No hay estudiantes matriculados todavía.
                            </div>
                          )}

                          {/* HORARIO */}
                          <h4>Horario del grupo</h4>
                          {horario.length ? (
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                marginBottom: 8,
                              }}
                            >
                              <thead>
                                <tr>
                                  <th
                                    style={{
                                      textAlign: "left",
                                      padding: 6,
                                    }}
                                  >
                                    Día
                                  </th>
                                  <th
                                    style={{
                                      textAlign: "left",
                                      padding: 6,
                                    }}
                                  >
                                    Aula
                                  </th>
                                  <th
                                    style={{
                                      textAlign: "left",
                                      padding: 6,
                                    }}
                                  >
                                    Inicio
                                  </th>
                                  <th
                                    style={{
                                      textAlign: "left",
                                      padding: 6,
                                    }}
                                  >
                                    Fin
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {horario.map((h, i) => (
                                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                                    <td style={{ padding: 6 }}>
                                      {diaToTexto(h.dia)}
                                    </td>
                                    <td style={{ padding: 6 }}>{h.aula}</td>
                                    <td style={{ padding: 6 }}>{h.inicio}</td>
                                    <td style={{ padding: 6 }}>{h.fin}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ marginBottom: 8 }}>
                              Sin horario definido.
                            </div>
                          )}

                          {/* Formulario para agregar horario */}
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                              marginTop: 4,
                            }}
                          >
                            <select
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
                              placeholder="Aula"
                              value={draft.aula}
                              onChange={(e) =>
                                onChangeNuevoHorario(g.id, "aula", e.target.value)
                              }
                              style={{ width: 80 }}
                            />

                            <input
                              type="time"
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
                              value={draft.fin}
                              onChange={(e) =>
                                onChangeNuevoHorario(g.id, "fin", e.target.value)
                              }
                            />

                            <button
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
        )}
      </section>
    </div>
  );
}
