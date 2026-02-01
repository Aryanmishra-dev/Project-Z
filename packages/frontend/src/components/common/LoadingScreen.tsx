import { Spinner } from '@/components/ui';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-600">
        <span className="text-3xl font-bold text-white">Q</span>
      </div>
      <Spinner size="lg" className="mt-8" />
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
}
