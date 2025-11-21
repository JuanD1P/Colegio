// src/Components/Login.test.jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';



// Mock de navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock de axios
import axios from 'axios';
vi.mock('axios', () => {
  const defaultAxios = {
    post: vi.fn(),
    defaults: {}, 
  };
  return {
    default: defaultAxios,
  };
});

// Mock de firebase client
import { auth } from '../firebase/client';
vi.mock('../firebase/client', () => ({
  auth: {}, // solo necesitamos una referencia
}));

// Mock de firebase/auth
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  getAdditionalUserInfo,
} from 'firebase/auth';

vi.mock('firebase/auth', () => {
  const mockProviderInstance = {
    setCustomParameters: vi.fn(),
  };

  return {
    signInWithEmailAndPassword: vi.fn(),
    GoogleAuthProvider: vi.fn(() => mockProviderInstance),
    signInWithPopup: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    getAdditionalUserInfo: vi.fn(),
  };
});

// --- Helper para renderizar ---

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

// --- Reset de mocks antes de cada test ---

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// --- TESTS ---

describe('Login component', () => {
  it('renderiza los campos básicos y el botón de ingresar', () => {
    renderLogin();

    const emailInput = screen.getByPlaceholderText(/correo/i);
    const passwordInput = screen.getByPlaceholderText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /ingresar/i });
    const googleButton = screen.getByRole('button', {
      name: /continuar con google/i,
    });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
    expect(googleButton).toBeInTheDocument();
  });

  it('muestra un toast si se intenta iniciar sesión con campos vacíos', async () => {
    const user = userEvent.setup();
    renderLogin();

    const submitButton = screen.getByRole('button', { name: /ingresar/i });

    await user.click(submitButton);

    const errorToast = await screen.findByText(
      /todos los campos deben ser completados/i
    );
    expect(errorToast).toBeInTheDocument();
  });

  it('hace login exitoso y redirige según rol ADMIN', async () => {
    const user = userEvent.setup();

    // Mock de Firebase + backend
    signInWithEmailAndPassword.mockResolvedValueOnce({
      user: {
        getIdToken: vi.fn().mockResolvedValue('fake-id-token'),
        displayName: 'Admin User',
      },
    });

    axios.post.mockResolvedValueOnce({
      data: {
        rol: 'ADMIN',
        uid: 'uid-123',
      },
    });

    renderLogin();

    const emailInput = screen.getByPlaceholderText(/correo/i);
    const passwordInput = screen.getByPlaceholderText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /ingresar/i });

    await user.type(emailInput, 'admin@example.com');
    await user.type(passwordInput, '12345678');
    await user.click(submitButton);

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      'admin@example.com',
      '12345678'
    );

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:3000/auth/session',
      { idToken: 'fake-id-token' }
    );

    expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });

    expect(localStorage.getItem('auth-token')).toBe('fake-id-token');
    expect(localStorage.getItem('user-role')).toBe('ADMIN');
  });

  it('abre el modal de reset y llama a sendPasswordResetEmail', async () => {
    const user = userEvent.setup();
    sendPasswordResetEmail.mockResolvedValueOnce();

    renderLogin();

    const forgotBtn = screen.getByRole('button', {
      name: /¿olvidaste tu contraseña\?/i,
    });

    await user.click(forgotBtn);

    const modalTitle = await screen.findByText(
      /tienes problemas para iniciar sesión\?/i
    );
    expect(modalTitle).toBeInTheDocument();

    const resetInput = screen.getByPlaceholderText(/correo electrónico/i);
    const sendBtn = screen.getByRole('button', { name: /enviar enlace/i });

    await user.type(resetInput, 'user@example.com');
    await user.click(sendBtn);

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      auth,
      'user@example.com'
    );
  });
});
