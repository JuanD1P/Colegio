// src/Components/FormEntregaTarea.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormEntregaTarea from './FormEntregaTarea';

// Mock de la API personalizada
import api from '../api/axios';
vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const tareaFutura = {
  id: 'tarea-123',
  fechaLimite: '2100-01-01T12:00:00.000Z', 
};

const tareaPasada = {
  id: 'tarea-999',
  fechaLimite: '2000-01-01T12:00:00.000Z', 
};

beforeEach(() => {
  vi.clearAllMocks();
});

const renderForm = (props = {}) =>
  render(
    <FormEntregaTarea
      tarea={tareaFutura}
      miEntrega={null}
      onSubmitted={vi.fn()}
      {...props}
    />
  );

describe('FormEntregaTarea component', () => {
  it('renderiza el formulario y el botón cuando la tarea no está expirada', async () => {
    // cuando no hay miEntregaProp, el componente intenta hacer un GET
    api.get.mockResolvedValueOnce({ data: null });

    renderForm();

    expect(
      screen.getByRole('heading', { name: /entrega de la tarea/i })
    ).toBeInTheDocument();

    // Formulario visible
    const comentario = screen.getByText(/comentario \(opcional\)/i);
    const enlaceInput = screen.getByPlaceholderText('https://...');
    const submitBtn = screen.getByRole('button', {
      name: /entregar tarea/i,
    });

    expect(comentario).toBeInTheDocument();
    expect(enlaceInput).toBeInTheDocument();
    expect(submitBtn).toBeInTheDocument();
  });

  it('muestra error y no llama a la API si se envía sin archivo ni enlace', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ data: null });

    renderForm();

    const submitBtn = screen.getByRole('button', {
      name: /entregar tarea/i,
    });

    await user.click(submitBtn);

    // Mensaje de error del componente
    const errorMsg = await screen.findByText(
      /debes adjuntar un archivo o colocar un enlace\./i
    );
    expect(errorMsg).toBeInTheDocument();

    // No se llama al endpoint
    expect(api.post).not.toHaveBeenCalled();
  });

  it('envía la entrega con enlace y llama onSubmitted cuando es exitoso', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ data: null });

    const onSubmitted = vi.fn();

    const respuestaEntrega = {
      id: 'entrega-1',
      enlace: 'https://mi-entrega.com',
      estado: 'entregada',
    };

    api.post.mockResolvedValueOnce({ data: respuestaEntrega });

    render(
      <FormEntregaTarea
        tarea={tareaFutura}
        miEntrega={null}
        onSubmitted={onSubmitted}
      />
    );

    const enlaceInput = screen.getByPlaceholderText('https://...');
    const submitBtn = screen.getByRole('button', {
      name: /entregar tarea/i,
    });

    await user.type(enlaceInput, 'https://mi-entrega.com');
    await user.click(submitBtn);

    expect(api.post).toHaveBeenCalledTimes(1);

    // URL correcta
    expect(api.post.mock.calls[0][0]).toBe(
      `/api/tareas/${tareaFutura.id}/entregas`
    );

    // Se envía FormData
    const formDataEnviado = api.post.mock.calls[0][1];
    expect(formDataEnviado).toBeInstanceOf(FormData);

    // Se llama el callback con la entrega creada
    expect(onSubmitted).toHaveBeenCalledWith(respuestaEntrega);
  });

  it('muestra aviso y oculta el formulario cuando la fecha límite expiró y no hay entrega', () => {
    api.get.mockResolvedValueOnce({ data: null });

    render(
      <FormEntregaTarea tarea={tareaPasada} miEntrega={null} onSubmitted={vi.fn()} />
    );

    // Mensaje de que ya expiró
    expect(
      screen.getByText(/la fecha límite ya expiró, no puedes enviar esta tarea\./i)
    ).toBeInTheDocument();

    // No debe estar el botón de enviar
    const submitBtn = screen.queryByRole('button', {
      name: /entregar tarea/i,
    });
    expect(submitBtn).toBeNull();
  });
});
