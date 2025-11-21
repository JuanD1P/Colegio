// src/App.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks de TODOS los componentes de páginas ---

vi.mock('./Components/Login', () => ({
  default: () => <div>Mock Login</div>,
}));

vi.mock('./Components/Registro', () => ({
  default: () => <div>Mock Registro</div>,
}));

vi.mock('./Components/Inicio', () => ({
  default: () => <div>Mock Inicio (Estudiante)</div>,
}));

vi.mock('./Components/NotFound', () => ({
  default: () => <div>Mock 404</div>,
}));

vi.mock('./Components/Admin', () => ({
  default: () => <div>Mock Admin</div>,
}));

vi.mock('./Components/Navbar', () => ({
  default: () => <div>Mock Navbar</div>,
}));

vi.mock('./Components/Footer', () => ({
  default: () => <div>Mock Footer</div>,
}));

vi.mock('./Components/Home', () => ({
  default: () => <div>Mock Home (Profesor)</div>,
}));

vi.mock('./Components/Grupos', () => ({
  default: () => <div>Mock Admin Grupos</div>,
}));

vi.mock('./Components/AdminCursos', () => ({
  default: () => <div>Mock Admin Cursos</div>,
}));

vi.mock('./Components/Perfil', () => ({
  default: () => <div>Mock Perfil</div>,
}));

// --- Mock de ProtectedRoute ---
// Lo hacemos sencillo: lee localStorage.user y decide si muestra children o un mensaje
vi.mock('./Components/PrivateRoute', () => ({
  default: ({ allowedRoles, children }) => {
    const saved = window.localStorage.getItem('user');
    if (!saved) {
      return <div>Mock ProtectedRoute: NoAuth</div>;
    }
    let user;
    try {
      user = JSON.parse(saved);
    } catch {
      return <div>Mock ProtectedRoute: NoAuth</div>;
    }
    const rol = (user.rol || '').toUpperCase();
    if (allowedRoles.includes(rol)) {
      return <>{children}</>;
    }
    return <div>Mock ProtectedRoute: Forbidden</div>;
  },
}));

// Después de definir los mocks, importamos App
import App from './App';

// --- Helpers ---

function renderAt(path) {
  // Cambiamos la URL actual antes de renderizar App
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

// --- TESTS ---

describe('App routing + ProtectedRoute wiring', () => {
  it('redirecciona "/" a "/userlogin" y muestra Login', () => {
    renderAt('/');

    expect(screen.getByText(/mock login/i)).toBeInTheDocument();
  });

  it('muestra Login en "/userlogin"', () => {
    renderAt('/userlogin');

    expect(screen.getByText(/mock login/i)).toBeInTheDocument();
  });

  it('muestra Registro en "/registro"', () => {
    renderAt('/registro');

    expect(screen.getByText(/mock registro/i)).toBeInTheDocument();
  });

  it('bloquea /home si no hay sesión (sin user en localStorage)', () => {
    renderAt('/home');

    expect(
      screen.getByText(/mock protectedroute: noauth/i)
    ).toBeInTheDocument();
  });

  it('permite /home sólo a rol PROFESOR', () => {
    // Caso PROFESOR: debe ver el Home del profe
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'p1', rol: 'PROFESOR', nombre: 'Profe' })
    );

    renderAt('/home');

    expect(
      screen.getByText(/mock home \(profesor\)/i)
    ).toBeInTheDocument();

    // Caso ESTUDIANTE: bloqueado
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'e1', rol: 'ESTUDIANTE', nombre: 'Estu' })
    );

    renderAt('/home');

    expect(
      screen.getByText(/mock protectedroute: forbidden/i)
    ).toBeInTheDocument();
  });

  it('permite /inicio sólo a rol ESTUDIANTE', () => {
    // Estudiante
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'e1', rol: 'ESTUDIANTE', nombre: 'Estu' })
    );

    renderAt('/inicio');

    expect(
      screen.getByText(/mock inicio \(estudiante\)/i)
    ).toBeInTheDocument();

    // Profe bloqueado
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'p1', rol: 'PROFESOR', nombre: 'Profe' })
    );

    renderAt('/inicio');

    expect(
      screen.getByText(/mock protectedroute: forbidden/i)
    ).toBeInTheDocument();
  });

  it('permite /admin sólo a rol ADMIN', () => {
    // Admin
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'a1', rol: 'ADMIN', nombre: 'Admin' })
    );

    renderAt('/admin');

    expect(screen.getByText(/mock admin/i)).toBeInTheDocument();

    // Estudiante bloqueado
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'e1', rol: 'ESTUDIANTE', nombre: 'Estu' })
    );

    renderAt('/admin');

    expect(
      screen.getByText(/mock protectedroute: forbidden/i)
    ).toBeInTheDocument();
  });

  it('permite /perfil a cualquier rol autenticado', () => {
    // Por ejemplo rol USER
    window.localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u1', rol: 'USER', nombre: 'Usuario' })
    );

    renderAt('/perfil');

    expect(screen.getByText(/mock perfil/i)).toBeInTheDocument();
  });

  it('muestra 404 en rutas que no existen', () => {
    renderAt('/ruta-que-no-existe');

    expect(screen.getByText(/mock 404/i)).toBeInTheDocument();
  });
});
