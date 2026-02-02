import { Outlet } from 'react-router-dom';

import { ErrorBoundary } from '@/components/common';

export function RootLayout() {
  return (
    <ErrorBoundary>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Outlet />
    </ErrorBoundary>
  );
}
