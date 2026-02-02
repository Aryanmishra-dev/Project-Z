import * as React from 'react';

import { cn } from '@/utils/cn';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton. Can be a number (pixels) or string (any CSS unit) */
  width?: number | string;
  /** Height of the skeleton. Can be a number (pixels) or string (any CSS unit) */
  height?: number | string;
  /** Make the skeleton circular */
  circle?: boolean;
  /** Number of skeleton lines to render */
  count?: number;
  /** Animation style */
  animation?: 'pulse' | 'shimmer' | 'none';
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    { className, width, height, circle = false, count = 1, animation = 'shimmer', style, ...props },
    ref
  ) => {
    const baseClasses = cn(
      'bg-gray-200 dark:bg-gray-700',
      {
        'rounded-full': circle,
        'rounded-md': !circle,
        'animate-pulse': animation === 'pulse',
        'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer':
          animation === 'shimmer',
      },
      className
    );

    const getStyle = (): React.CSSProperties => ({
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      ...style,
    });

    if (count === 1) {
      return <div ref={ref} className={baseClasses} style={getStyle()} {...props} />;
    }

    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            ref={index === 0 ? ref : undefined}
            className={baseClasses}
            style={getStyle()}
            {...props}
          />
        ))}
      </div>
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Preset skeleton components for common use cases
const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton key={index} height={16} width={index === lines - 1 ? '60%' : '100%'} />
    ))}
  </div>
);

const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
  };
  return <Skeleton circle width={sizeMap[size]} height={sizeMap[size]} className={className} />;
};

const SkeletonButton: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizeMap = {
    sm: { width: 80, height: 32 },
    md: { width: 100, height: 40 },
    lg: { width: 120, height: 48 },
  };
  return (
    <Skeleton
      width={sizeMap[size].width}
      height={sizeMap[size].height}
      className={cn('rounded-md', className)}
    />
  );
};

const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-lg border border-gray-200 p-4 space-y-4', className)}>
    <div className="flex items-center space-x-4">
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton height={20} width="40%" />
        <Skeleton height={14} width="60%" />
      </div>
    </div>
    <SkeletonText lines={3} />
    <div className="flex justify-end space-x-2">
      <SkeletonButton size="sm" />
      <SkeletonButton size="sm" />
    </div>
  </div>
);

const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => (
  <div className={cn('space-y-2', className)}>
    {/* Header */}
    <div className="flex space-x-4 pb-2 border-b border-gray-200">
      {Array.from({ length: columns }).map((_, col) => (
        <Skeleton key={col} height={20} className="flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, row) => (
      <div key={row} className="flex space-x-4 py-2">
        {Array.from({ length: columns }).map((_, col) => (
          <Skeleton key={col} height={16} className="flex-1" />
        ))}
      </div>
    ))}
  </div>
);

const SkeletonQuizCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-xl border border-gray-200 p-6 space-y-6', className)}>
    {/* Question number and timer */}
    <div className="flex items-center justify-between">
      <Skeleton height={24} width={120} />
      <Skeleton height={24} width={80} />
    </div>

    {/* Question text */}
    <div className="space-y-2">
      <Skeleton height={24} width="100%" />
      <Skeleton height={24} width="80%" />
    </div>

    {/* Answer options */}
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={56} className="rounded-lg" />
      ))}
    </div>

    {/* Navigation buttons */}
    <div className="flex justify-between pt-4">
      <SkeletonButton />
      <SkeletonButton />
    </div>
  </div>
);

const SkeletonDashboard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-6', className)}>
    {/* Stats row */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-2">
          <Skeleton height={14} width="60%" />
          <Skeleton height={32} width="40%" />
          <Skeleton height={12} width="80%" />
        </div>
      ))}
    </div>

    {/* Chart area */}
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <Skeleton height={24} width={200} />
      <Skeleton height={200} />
    </div>

    {/* Recent activity */}
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <Skeleton height={24} width={150} />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <SkeletonAvatar size="sm" />
            <div className="flex-1 space-y-1">
              <Skeleton height={16} width="70%" />
              <Skeleton height={12} width="40%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonTable,
  SkeletonQuizCard,
  SkeletonDashboard,
};
