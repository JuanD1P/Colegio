import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "@sweetalert2/themes/borderless/borderless.css";
import api from "../api/axios";
import logo from "../ImagenesP/ImagenesLogin/ADMINLOGO.png";
import "./DOCSS/Admin.css";

const ROLES = ["ESTUDIANTE", "PROFESOR", "ADMIN", "USER"];

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("pendientes"); // pendientes | activos | rechazados
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get("/api/usuarios");
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || "No fue posible cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  async function aprobarUsuario(id, rol) {
    try {
      await api.put(`/api/usuarios/${id}/aprobar`, { rol });
      await fetchUsuarios();
      Swal.fire({
        icon: "success",
        title: `Aprobado como ${rol}`,
        timer: 900,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "No se pudo aprobar",
        text: e?.response?.data?.error || "Intenta de nuevo",
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    }
  }

  async function rechazarUsuario(id) {
    try {
      await api.put(`/api/usuarios/${id}/rechazar`);
      await fetchUsuarios();
      Swal.fire({
        icon: "success",
        title: "Usuario rechazado",
        timer: 900,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "No se pudo rechazar",
        text: e?.response?.data?.error || "Intenta de nuevo",
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    }
  }

  async function cambiarRol(id, nuevoRol) {
    try {
      await api.put(`/api/usuarios/${id}/rol`, { rol: nuevoRol });
      await fetchUsuarios();
      Swal.fire({
        icon: "success",
        title: "Rol actualizado",
        timer: 900,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el rol",
        text: e?.response?.data?.error || "Intenta de nuevo",
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    }
  }

  async function eliminarUsuario(id) {
    const { isConfirmed } = await Swal.fire({
      title: "¿Eliminar usuario?",
      text: "Se eliminará su documento y cuenta de Auth.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: "sw-popup",
        confirmButton: "sw-confirm",
        cancelButton: "sw-cancel",
      },
    });
    if (!isConfirmed) return;

    try {
      await api.delete(`/api/usuarios/${id}`);
      await fetchUsuarios();
      Swal.fire({
        icon: "success",
        title: "Eliminado",
        timer: 900,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: e?.response?.data?.error || "Intenta de nuevo",
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    }
  }

  const list = useMemo(() => {
    const byTab = usuarios.filter((u) => {
      if (tab === "pendientes") return (u.estado || "pendiente") === "pendiente";
      if (tab === "rechazados") return u.estado === "rechazada";
      return (u.estado || "activo") === "activo";
    });
    const s = q.trim().toLowerCase();
    if (!s) return byTab;
    return byTab.filter((u) =>
      [u.id, u.nombre, u.nombre_completo, u.email, u.rol]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [usuarios, tab, q]);

  return (
    <div className="admin-page">
      <div className="admin-overlay" />

      <header className="admin-header glass-strong">
        <div className="admin-header-left">
          <img src={logo} alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">Panel de Administración</h1>
            <p className="admin-subtitle">Gestión de usuarios</p>
          </div>
        </div>

        <div className="admin-header-actions">
          <button onClick={fetchUsuarios} className="btn">
            Actualizar
          </button>
          <button
            onClick={() => (window.location.href = "/GraficasA")}
            className="btn accent"
          >
            DATOS PRODUCTOS
          </button>
        </div>
      </header>

      <main className="admin-content">
        <section className="card glass-strong">
          <div className="card-head">
            <div className="tabs">
              <button
                className={`tab ${tab === "pendientes" ? "active" : ""}`}
                onClick={() => setTab("pendientes")}
              >
                Pendientes
              </button>
              <button
                className={`tab ${tab === "activos" ? "active" : ""}`}
                onClick={() => setTab("activos")}
              >
                Activos
              </button>
              <button
                className={`tab ${tab === "rechazados" ? "active" : ""}`}
                onClick={() => setTab("rechazados")}
              >
                Rechazados
              </button>
            </div>

            <div className="tools">
              <input
                className="search"
                placeholder="Buscar por email/nombre/rol…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="chip">
                {loading ? "Cargando…" : `${list.length} usuarios`}
              </div>
            </div>
          </div>

          {err && <div className="alert error">{err}</div>}

          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ minWidth: 280 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="skeleton-row" />
                    </td>
                  </tr>
                ) : list.length ? (
                  list.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.id}</td>
                      <td className="cell-strong">
                        {u.nombre_completo || u.nombre || "-"}
                      </td>
                      <td>{u.email}</td>
                      <td>{u.rol || "-"}</td>
                      <td>{u.estado || "-"}</td>
                      <td>
                        {tab === "pendientes" || tab === "rechazados" ? (
                          <>
                            <div className="btn-group">
                              <button
                                className="btn"
                                onClick={() =>
                                  aprobarUsuario(u.id, "ESTUDIANTE")
                                }
                              >
                                Aprobar (ESTUDIANTE)
                              </button>
                              <button
                                className="btn"
                                onClick={() =>
                                  aprobarUsuario(u.id, "PROFESOR")
                                }
                              >
                                Aprobar (PROFESOR)
                              </button>
                              <button
                                className="btn accent"
                                onClick={() => aprobarUsuario(u.id, "ADMIN")}
                              >
                                Aprobar (ADMIN)
                              </button>
                            </div>
                            <button
                              className="btn danger"
                              style={{ marginLeft: 8 }}
                              onClick={() => rechazarUsuario(u.id)}
                            >
                              Rechazar
                            </button>
                          </>
                        ) : (
                          <>
                            <select
                              className="admin-role-select"
                              value={u.rol || "USER"}
                              onChange={(e) =>
                                cambiarRol(u.id, e.target.value)
                              }
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn danger"
                              style={{ marginLeft: 8 }}
                              onClick={() => eliminarUsuario(u.id)}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="cell-empty">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
