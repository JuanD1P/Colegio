
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormTarea from './FormTarea';


import api from '../api/axios';
vi.mock('../api/axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const renderForm = (props = {}) =>
  render(
    <FormTarea
      cursoId="curso-1"
      grupoId="grupo-A"
      onCreated={vi.fn()}
      {...props}
    />
  );

describe('FormTarea component', () => {
  it('renderiza los campos requeridos y el botón', () => {
    renderForm();

    const tituloInput = screen.getByLabelText(/título \*/i);
    const descripcionInput = screen.getByLabelText(/descripción \*/i);
    const fechaInput = screen.getByLabelText(/fecha límite \*/i);
    const submitButton = screen.getByRole('button', { name: /crear tarea/i });

    expect(tituloInput).toBeInTheDocument();
    expect(descripcionInput).toBeInTheDocument();
    expect(fechaInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  it('no llama a la API si se envía con campos vacíos', async () => {
    const user = userEvent.setup();
    renderForm();

    const submitButton = screen.getByRole('button', { name: /crear tarea/i });

    await user.click(submitButton);


    expect(api.post).not.toHaveBeenCalled();
  });

  it('envía los datos a la API y llama onCreated cuando es exitoso', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    api.post.mockResolvedValueOnce({
      data: { id: 'tarea-123', titulo: 'Mi tarea' },
    });

    renderForm({ onCreated });

    const tituloInput = screen.getByLabelText(/título \*/i);
    const descripcionInput = screen.getByLabelText(/descripción \*/i);
    const fechaInput = screen.getByLabelText(/fecha límite \*/i);
    const submitButton = screen.getByRole('button', { name: /crear tarea/i });

    await user.type(tituloInput, 'Mi tarea');
    await user.type(descripcionInput, 'Descripción de la tarea');
    await user.type(fechaInput, '2025-11-21T12:30');

    await user.click(submitButton);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      '/api/tareas',
      expect.objectContaining({
        titulo: 'Mi tarea',
        descripcion: 'Descripción de la tarea',
        cursoId: 'curso-1',
        grupoId: 'grupo-A',
        fechaLimite: expect.any(String), 
      })
    );

    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tarea-123', titulo: 'Mi tarea' })
    );

    expect(tituloInput).toHaveValue('');
    expect(descripcionInput).toHaveValue('');
    expect(fechaInput).toHaveValue('');
  });

  it('muestra mensaje de error cuando la API falla', async () => {
    const user = userEvent.setup();

    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Error desde el servidor' } },
    });

    renderForm();

    const tituloInput = screen.getByLabelText(/título \*/i);
    const descripcionInput = screen.getByLabelText(/descripción \*/i);
    const fechaInput = screen.getByLabelText(/fecha límite \*/i);
    const submitButton = screen.getByRole('button', { name: /crear tarea/i });

    await user.type(tituloInput, 'Tarea con error');
    await user.type(descripcionInput, 'Algo');
    await user.type(fechaInput, '2025-11-21T12:30');

    await user.click(submitButton);


    const errorMsg = await screen.findByText(/error desde el servidor/i);
    expect(errorMsg).toBeInTheDocument();
  });
});
