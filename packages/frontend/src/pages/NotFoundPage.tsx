import { Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui';
import { ROUTES } from '@/utils/constants';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-600">404</h1>
        <h2 className="mt-4 text-3xl font-bold text-gray-900">Page not found</h2>
        <p className="mt-2 text-lg text-gray-500">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button onClick={() => window.history.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
          <Link to={ROUTES.HOME}>
            <Button>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
