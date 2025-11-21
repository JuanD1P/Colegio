// src/Components/Inicio.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// --- Mocks de módulos usados por Inicio ---

// Mock de la API
vi.mock('../api/axios', () => {
  const defaultApi = {
    get: vi.fn(),
    post: vi.fn(),
  };
  return { default: defaultApi };
});

// Mock de FormEntregaTarea para no montar toda su lógica otra vez
vi.mock('./FormEntregaTarea', () => ({
  default: () => <div data-testid="mock-entrega">Mock Entrega</div>,
}));

import api from '../api/axios';
import Inicio from './Inicio';

// --- Helpers ---

const renderInicio = () =>
  render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// --- TESTS ---

describe('Inicio (panel estudiante)', () => {
  it('muestra mensaje de "Debes iniciar sesión" si no hay usuario en localStorage', () => {
    renderInicio();

    expect(
      screen.getByText(/debes iniciar sesión\./i)
    ).toBeInTheDocument();
  });

  it('muestra mensaje de que la página es solo para estudiantes si el rol no es ESTUDIANTE', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u1',
        rol: 'PROFESOR',
        nombre: 'Profe',
      })
    );

    renderInicio();

    expect(
      screen.getByText(/esta página está diseñada para estudiantes\./i)
    ).toBeInTheDocument();
  });

  it('para un estudiante sin grupos, muestra el mensaje de que no está matriculado en ningún grupo', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'alumno1',
        rol: 'ESTUDIANTE',
        nombre: 'Juan',
      })
    );

    api.get.mockResolvedValueOnce({ data: [] }); // grupos del alumno

    renderInicio();

    const msg = await screen.findByText(
      /no estás matriculado en ningún grupo actualmente\./i
    );
    expect(msg).toBeInTheDocument();
  });

  it('muestra el select de cursos cuando el estudiante tiene al menos un grupo', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'alumno1',
        rol: 'ESTUDIANTE',
        nombre: 'Juan',
      })
    );

    // grupos del alumno
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 'g1',
          cursoId: 'c1',
          cursoNombre: 'Matemáticas',
          nombreGrupo: 'A',
        },
      ],
    });

    renderInicio();

    // esperamos a que se carguen los grupos y aparezca el select
    const selectCurso = await screen.findByRole('combobox');
    expect(selectCurso).toBeInTheDocument();

    // la opción del curso "Matemáticas" debe existir
    const opcionCurso = screen.getByRole('option', {
      name: /matemáticas/i,
    });
    expect(opcionCurso).toBeInTheDocument();
  });
});
