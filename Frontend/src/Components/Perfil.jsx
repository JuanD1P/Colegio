// src/Components/Perfil.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Perfil() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    tipoDoc: "CC",
    documento: "",
    telefono: "",
    direccion: "",
    grado: "",
    seccion: "",
    fechaNac: "",
    acudienteNombre: "",
    acudienteTelefono: "",
    tituloAcademico: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const navigate = useNavigate();

  // Leer user desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      } catch (e) {
        console.error("Error parseando user de localStorage", e);
      }
    }
  }, []);

  // Cargar datos actuales del perfil
  useEffect(() => {
    if (!user) return;

    const cargarPerfil = async () => {
      try {
        setLoadingPerfil(true);
        setError("");
        const res = await api.get("/api/mi-perfil");
        const data = res.data || {};
        setForm((prev) => ({
          ...prev,
          nombres: data.nombres || "",
          apellidos: data.apellidos || "",
          tipoDoc: data.tipoDoc || "CC",
          documento: data.documento || "",
          telefono: data.telefono || "",
          direccion: data.direccion || "",
          grado: data.grado || "",
          seccion: data.seccion || "",
          fechaNac: data.fechaNac || "",
          acudienteNombre: data.acudienteNombre || "",
          acudienteTelefono: data.acudienteTelefono || "",
          tituloAcademico: data.tituloAcademico || "",
        }));
      } catch (err) {
        console.error("Error cargando mi perfil:", err.response?.data || err);
        setError(
          err.response?.data?.error || "No se pudo cargar tu perfil."
        );
      } finally {
        setLoadingPerfil(false);
      }
    };

    cargarPerfil();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setOkMsg("");
    setError("");

    // validaciones mínimas
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      setError("Nombres y apellidos son obligatorios.");
      return;
    }
    if (!form.documento.trim()) {
      setError("El documento es obligatorio.");
      return;
    }

    try {
      setLoading(true);
      await api.put("/api/mi-perfil", form);
      setOkMsg("Perfil actualizado correctamente ✅");

      // Actualizar flag en localStorage para no volver a pedir
      if (user) {
        const nuevoUser = { ...user, perfilCompleto: true };
        localStorage.setItem("user", JSON.stringify(nuevoUser));
        setUser(nuevoUser);
      }

      // Redirigir según rol
      const rol = (user?.rol || "").toUpperCase();
      if (rol === "PROFESOR") {
        navigate("/home", { replace: true });
      } else if (rol === "ESTUDIANTE") {
        navigate("/inicio", { replace: true });
      } else if (rol === "ADMIN") {
        navigate("/admin", { replace: true });
      }
    } catch (err) {
      console.error("Error guardando perfil:", err.response?.data || err);
      setError(
        err.response?.data?.error || "No se pudo actualizar tu perfil."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <p>Debes iniciar sesión.</p>;
  }

  const rol = (user.rol || "").toUpperCase();
  const esEstudiante = rol === "ESTUDIANTE";
  const esProfesor = rol === "PROFESOR";

  return (
    <div className="container" style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1>Completa tu perfil</h1>
      <p>
        Necesitamos algunos datos adicionales para tu registro en el colegio.
      </p>

      {loadingPerfil && <p>Cargando tus datos...</p>}

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
      )}
      {okMsg && (
        <p style={{ color: "green", marginTop: "0.5rem" }}>{okMsg}</p>
      )}

      {!loadingPerfil && (
        <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
          <div className="field">
            <label>Nombres</label>
            <input
              name="nombres"
              value={form.nombres}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label>Apellidos</label>
            <input
              name="apellidos"
              value={form.apellidos}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label>Tipo de documento</label>
            <select
              name="tipoDoc"
              value={form.tipoDoc}
              onChange={handleChange}
            >
              <option value="CC">CC</option>
              <option value="TI">TI</option>
              <option value="CE">CE</option>
              <option value="PA">Pasaporte</option>
            </select>
          </div>

          <div className="field">
            <label>Número de documento</label>
            <input
              name="documento"
              value={form.documento}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label>Teléfono</label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Dirección</label>
            <input
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
            />
          </div>

          {/* Campos típicos de estudiante */}
          {esEstudiante && (
            <>
              <div className="field">
                <label>Grado</label>
                <input
                  name="grado"
                  value={form.grado}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Sección</label>
                <input
                  name="seccion"
                  value={form.seccion}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Fecha de nacimiento</label>
                <input
                  type="date"
                  name="fechaNac"
                  value={form.fechaNac}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Nombre acudiente</label>
                <input
                  name="acudienteNombre"
                  value={form.acudienteNombre}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Teléfono acudiente</label>
                <input
                  name="acudienteTelefono"
                  value={form.acudienteTelefono}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {/* Campo típico de profesor */}
          {esProfesor && (
            <div className="field">
              <label>Título académico</label>
              <input
                name="tituloAcademico"
                value={form.tituloAcademico}
                onChange={handleChange}
              />
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar perfil"}
          </button>
        </form>
      )}
    </div>
  );
}
