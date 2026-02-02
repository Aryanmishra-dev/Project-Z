import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ProtectedRoute } from '../ProtectedRoute';

import * as authStore from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock react-router-dom's Navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Redirecting to {to}</div>,
  };
});

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when user is authenticated', () => {
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', email: 'test@test.com' },
    } as any);

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as any);

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('Redirecting to /login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows loading state while checking authentication', () => {
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      accessToken: 'valid-token',
      user: null,
    } as any);

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    // Should show loading indicator instead of content or redirect
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('redirects to custom path when specified', () => {
    vi.mocked(authStore.useAuthStore).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as any);

    renderWithRouter(
      <ProtectedRoute redirectTo="/custom-login">
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('Redirecting to /custom-login');
  });
});
