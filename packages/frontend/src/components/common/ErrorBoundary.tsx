import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-100">
                <AlertTriangle className="h-6 w-6 text-error-600" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                Something went wrong
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                An unexpected error occurred. Please try again.
              </p>
              {this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error details
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-800">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <Button
                onClick={this.handleRetry}
                className="mt-6"
                variant="primary"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional error fallback component
interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4" role="alert">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-100">
            <AlertTriangle className="h-6 w-6 text-error-600" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Oops! Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            We're sorry, but something unexpected happened.
          </p>
          {error && (
            <p className="mt-2 text-xs text-gray-400">{error.message}</p>
          )}
          {resetError && (
            <Button onClick={resetError} className="mt-6" variant="primary">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
