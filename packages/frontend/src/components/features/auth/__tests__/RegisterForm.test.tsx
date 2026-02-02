import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RegisterForm } from '../RegisterForm';

import * as authStore from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockRegister = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      register: mockRegister,
      isLoading: false,
    } as any);
  });

  it('renders all required fields', () => {
    render(<RegisterForm />, { wrapper: createWrapper() });

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<RegisterForm />, { wrapper: createWrapper() });
    expect(
      screen.getByRole('button', { name: /create account|sign up|register/i })
    ).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: /create account|sign up|register/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText(/required|must|invalid/i).length).toBeGreaterThan(0);
    });
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different123');

    const submitButton = screen.getByRole('button', { name: /create account|sign up|register/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords.*match|don't match/i)).toBeInTheDocument();
    });
  });

  it('shows password strength indicator', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />, { wrapper: createWrapper() });

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'weak');

    // Should show some strength indicator (weak, medium, strong)
    await waitFor(() => {
      expect(screen.getByText(/8\+ characters/i)).toBeInTheDocument();
    });
  });

  it('calls register with correct data', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({ success: true });
    render(<RegisterForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');

    const submitButton = screen.getByRole('button', { name: /create account|sign up|register/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!',
        })
      );
    });
  });

  it('has link to login page', () => {
    render(<RegisterForm />, { wrapper: createWrapper() });
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in|log in/i })).toHaveAttribute('href', '/login');
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /create account|sign up|register/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });
});
