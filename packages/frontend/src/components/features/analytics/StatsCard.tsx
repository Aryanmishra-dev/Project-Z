import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui';
import { cn } from '@/utils/cn';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  change?: {
    value: number;
    period: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

export function StatsCard({
  icon,
  label,
  value,
  subValue,
  change,
  variant = 'default',
}: StatsCardProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-600',
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    error: 'bg-error-100 text-error-600',
  };

  const getTrendIcon = () => {
    if (!change) return null;
    if (change.value > 0) return <TrendingUp className="h-4 w-4" />;
    if (change.value < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (!change) return '';
    if (change.value > 0) return 'text-success-600';
    if (change.value < 0) return 'text-error-600';
    return 'text-gray-500';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              variantStyles[variant]
            )}
          >
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
          </div>
        </div>
        {change && (
          <div className={cn('mt-4 flex items-center gap-1 text-sm', getTrendColor())}>
            {getTrendIcon()}
            <span>
              {change.value > 0 ? '+' : ''}
              {change.value}%
            </span>
            <span className="text-gray-500">from {change.period}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
