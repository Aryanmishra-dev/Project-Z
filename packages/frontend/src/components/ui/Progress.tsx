import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/utils/cn';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  showValue?: boolean;
  label?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, max = 100, variant = 'default', showValue = false, label, ...props }, ref) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variantStyles = {
    default: 'bg-primary-600',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  };

  return (
    <div className="w-full space-y-1">
      {(label || showValue) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-gray-700">{label}</span>}
          {showValue && <span className="text-gray-500">{Math.round(percentage)}%</span>}
        </div>
      )}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-gray-200',
          className
        )}
        aria-label={label || 'Progress'}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full transition-all duration-300 ease-out',
            variantStyles[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
});

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
