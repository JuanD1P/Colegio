// src/Components/Navbar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./DOCSS/Navbar.css";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const rol = (user?.rol || "").toUpperCase();
  const esProfe = rol === "PROFESOR";
  const esEstudiante = rol === "ESTUDIANTE";

  const irInicio = () => {
    if (esProfe) navigate("/home");
    else if (esEstudiante) navigate("/inicio");
    else navigate("/");
  };

  const irPerfil = () => {
    navigate("/perfil");
  };

  const cerrarSesion = () => {
    localStorage.removeItem("user");
    navigate("/userlogin", { replace: true });
  };

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) {
      // un poquito de offset por la navbar
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <header
      className={`nav-root
        ${esProfe ? "nav-root--profe" : ""}
        ${esEstudiante ? "nav-root--estu" : ""}`}
    >
      <div className="nav-inner">
        {/* Logo / título */}
        <button className="nav-logo" onClick={irInicio}>
          <div className="nav-logoImgWrapper">
            {/* logo.png en /public */}
            <img src="/logo_solo.png" alt="Colegio Lindo" />
          </div>
          <div className="nav-logoTextBlock">
            <span className="nav-logoTitle">Educa</span>
            <span className="nav-logoSubtitle">
              {esProfe
                ? "Panel de profesor"
                : esEstudiante
                ? "Panel de estudiante"
                : "Plataforma"}
            </span>
          </div>
        </button>

        {/* Links del profesor */}
        {esProfe && (
          <nav className="nav-links">
            <button className="nav-link" onClick={irPerfil}>
              Mi perfil
            </button>
          </nav>
        )}

        {/* Links del estudiante */}
        {esEstudiante && (
          <nav className="nav-links">
            <button
              className={`nav-link ${
                location.pathname === "/inicio" ? "nav-link--active" : ""
              }`}
              onClick={irInicio}
            >
              Mis cursos
            </button>
            <button
              className={`nav-link ${
                location.pathname === "/perfil" ? "nav-link--active" : ""
              }`}
              onClick={irPerfil}
            >
              Mi perfil
            </button>
          </nav>
        )}

        {/* Lado derecho: nombre y cerrar sesión */}
        <div className="nav-right">
          {user && (
            <span className="nav-user">
              {user.nombre || user.nombres || "Usuario"}
            </span>
          )}
          <button className="nav-logout" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
