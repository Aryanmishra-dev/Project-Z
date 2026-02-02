import { Navigate, useLocation } from 'react-router-dom';

import { LoadingScreen } from './LoadingScreen';

import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/utils/constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, accessToken } = useAuthStore();
  const location = useLocation();

  // Show loading while checking auth state (only if a token exists)
  if (isLoading && accessToken) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  // Check for token in localStorage on initial load
  if (!isAuthenticated && !accessToken) {
    // Redirect to login, but save the attempted location
    return <Navigate to={redirectTo || ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
