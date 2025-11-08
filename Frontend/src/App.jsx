// src/App.jsx
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import Login from './Components/Login';
import Registro from './Components/Registro';
import Inicio from './Components/Inicio';
import NotFound from './Components/NotFound';
import ProtectedRoute from './Components/PrivateRoute';
import Admin from './Components/Admin';
import Navbar from './Components/Navbar';
import Footer from './Components/Footer';
import Home from './Components/Home';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/userlogin" />} />

        <Route path="/userlogin" element={<Login />} />
        <Route path="/Registro" element={<Registro />} />

        <Route element={<LayoutWithNavbar />}>
          <Route path="/Home" element={<Home />} />

          <Route
            path="/Admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Admin />
              </ProtectedRoute>
            }
          />

          <Route
            path="/Inicio"
            element={
              <ProtectedRoute allowedRoles={['ESTUDIANTE','PROFESOR','USER']}>
                <Inicio />
              </ProtectedRoute>
            }
          />
        </Route>

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
