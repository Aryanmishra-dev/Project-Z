import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LoginForm } from '../LoginForm';

import * as authStore from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockLogin = vi.fn();

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

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: false,
    } as any);
  });

  it('renders email and password inputs', () => {
    render(<LoginForm />, { wrapper: createWrapper() });

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<LoginForm />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required|invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginForm />, { wrapper: createWrapper() });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Ensure blur

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('calls login with correct credentials', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ success: true });
    render(<LoginForm />, { wrapper: createWrapper() });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('has link to register page', () => {
    render(<LoginForm />, { wrapper: createWrapper() });
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up|register/i })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('shows loading state during submission', () => {
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: true,
    } as any);

    render(<LoginForm />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toBeDisabled();
  });

  it('has password visibility toggle', async () => {
    const user = userEvent.setup();
    render(<LoginForm />, { wrapper: createWrapper() });

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find and click the toggle button
    const toggleButton = screen.getByRole('button', { name: /show password|toggle password/i });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
