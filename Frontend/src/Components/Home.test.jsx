// src/Components/Home.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './Home';

// --- Mocks de módulos usados por Home ---

// Mock de la API
vi.mock('../api/axios', () => {
  const defaultApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return { default: defaultApi };
});

// Mock de FormMaterial y FormTarea para no montar toda su lógica
vi.mock('./FormMaterial', () => ({
  default: () => <div data-testid="mock-form-material">Mock FormMaterial</div>,
}));

vi.mock('./FormTarea', () => ({
  default: () => <div data-testid="mock-form-tarea">Mock FormTarea</div>,
}));

import api from '../api/axios';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// --- HELPERS ---

const renderHome = () => render(<Home />);

// --- TESTS ---

describe('Home (panel profesor)', () => {
  it('muestra "Debes iniciar sesión" si no hay usuario en localStorage', () => {
    renderHome();

    expect(
      screen.getByText(/debes iniciar sesión\./i)
    ).toBeInTheDocument();
  });

  it('muestra mensaje de que la página es solo para docentes si el rol no es PROFESOR', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u1',
        rol: 'ESTUDIANTE',
        nombre: 'Alumno',
      })
    );

    renderHome();

    expect(
      screen.getByText(/esta página está diseñada para docentes\./i)
    ).toBeInTheDocument();
  });

  it('si el profesor no tiene grupos asignados, muestra el mensaje correspondiente', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'profe1',
        rol: 'PROFESOR',
        nombre: 'Profe',
      })
    );

    // llamada a /api/profesores/:id/grupos
    api.get.mockResolvedValueOnce({ data: [] });

    renderHome();

    const msg = await screen.findByText(
      /no estás asignado a ningún grupo todavía/i
    );
    expect(msg).toBeInTheDocument();
  });

  it('cuando el profesor tiene grupos, muestra el select de cursos con el curso correspondiente', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'profe1',
        rol: 'PROFESOR',
        nombre: 'Profe',
      })
    );

    // llamada a /api/profesores/:id/grupos
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 'g1',
          cursoId: 'c1',
          cursoNombre: 'Matemáticas',
          nombre: 'Grupo A',
        },
      ],
    });

    renderHome();

    // Esperamos a que se carguen los grupos y aparezca el select
    const selectCurso = await screen.findByRole('combobox');
    expect(selectCurso).toBeInTheDocument();

    const opcionCurso = screen.getByRole('option', {
      name: /matemáticas/i,
    });
    expect(opcionCurso).toBeInTheDocument();
  });
});
