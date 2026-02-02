import { Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/utils/cn';
import { formatTimer } from '@/utils/formatters';

interface QuizTimerProps {
  seconds: number;
  onTick: () => void;
  isPaused?: boolean;
  warningThreshold?: number; // Seconds remaining to show warning
}

export function QuizTimer({
  seconds,
  onTick,
  isPaused = false,
  warningThreshold = 60,
}: QuizTimerProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPaused || seconds <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      onTick();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, seconds, onTick]);

  const isWarning = seconds > 0 && seconds <= warningThreshold;
  const isCritical = seconds > 0 && seconds <= 30;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full px-4 py-2 font-mono text-sm font-medium',
        !isWarning && 'bg-gray-100 text-gray-700',
        isWarning && !isCritical && 'bg-warning-100 text-warning-700',
        isCritical && 'bg-error-100 text-error-700 animate-pulse'
      )}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatTimer(seconds)}`}
    >
      {isCritical ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      {formatTimer(seconds)}
    </div>
  );
}
