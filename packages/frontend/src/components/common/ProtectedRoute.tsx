import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingScreen } from './LoadingScreen';
import { ROUTES } from '@/utils/constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, accessToken } = useAuthStore();
  const location = useLocation();

  // Show loading while checking auth state (only if a token exists)
  if (isLoading && accessToken) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  // Check for token in localStorage on initial load
  if (!isAuthenticated && !accessToken) {
    // Redirect to login, but save the attempted location
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
