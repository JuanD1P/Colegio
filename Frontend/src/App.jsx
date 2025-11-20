// src/App.jsx
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  Outlet,
} from "react-router-dom";

import Login from "./Components/Login";
import Registro from "./Components/Registro";
import Inicio from "./Components/Inicio";
import NotFound from "./Components/NotFound";
import ProtectedRoute from "./Components/PrivateRoute";
import Admin from "./Components/Admin";
import Navbar from "./Components/Navbar";
import Footer from "./Components/Footer";
import Home from "./Components/Home";
import Grupos from "./Components/Grupos";
import AdminCursos from "./Components/AdminCursos";
import Perfil from "./Components/Perfil";

function App() {
  return (
    <Router>
      <Routes>
        {/* raíz → login */}
        <Route path="/" element={<Navigate to="/userlogin" />} />

        {/* auth pública */}
        <Route path="/userlogin" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* todo lo que lleva navbar/footer */}
        <Route element={<LayoutWithNavbar />}>
          {/* PROFESOR */}
          <Route
            path="/home"
            element={
              <ProtectedRoute allowedRoles={["PROFESOR"]}>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* ESTUDIANTE */}
          <Route
            path="/inicio"
            element={
              <ProtectedRoute allowedRoles={["ESTUDIANTE"]}>
                <Inicio />
              </ProtectedRoute>
            }
          />

          {/* PERFIL (cualquier usuario autenticado) */}
          <Route
            path="/perfil"
            element={
              <ProtectedRoute
                allowedRoles={["ADMIN", "PROFESOR", "ESTUDIANTE", "USER"]}
              >
                <Perfil />
              </ProtectedRoute>
            }
          />

          {/* ADMIN – Panel de usuarios */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Admin />
              </ProtectedRoute>
            }
          />

          {/* ADMIN – Gestión de grupos */}
          <Route
            path="/admin/grupos"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Grupos />
              </ProtectedRoute>
            }
          />

          {/* ADMIN – Gestión de cursos */}
          <Route
            path="/admin/cursos"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminCursos />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

function LayoutWithNavbar() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

export default App;
