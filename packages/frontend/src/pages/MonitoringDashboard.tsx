import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Server,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { api } from '@/lib/api';

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    nlp: ServiceStatus;
  };
  metrics: SystemMetrics;
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapUsedPercent: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  requests: {
    total: number;
    success: number;
    error: number;
    errorRate: number;
  };
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
}

const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig = {
    healthy: { icon: CheckCircle, color: 'text-success-500', bgColor: 'bg-success-50' },
    degraded: { icon: AlertTriangle, color: 'text-warning-500', bgColor: 'bg-warning-50' },
    unhealthy: { icon: XCircle, color: 'text-error-500', bgColor: 'bg-error-50' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unhealthy;
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1 rounded-full', config.bgColor)}>
      <Icon className={cn('h-4 w-4', config.color)} />
      <span className={cn('text-sm font-medium capitalize', config.color)}>{status}</span>
    </div>
  );
};

const ServiceStatusCard: React.FC<{ name: string; service: ServiceStatus }> = ({
  name,
  service,
}) => {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            service.status === 'healthy' ? 'bg-success-500' : 'bg-error-500'
          )}
        />
        <span className="font-medium">{name}</span>
      </div>
      <div className="text-right">
        <span className="text-sm text-gray-600">
          {service.latency !== undefined ? `${service.latency}ms` : 'N/A'}
        </span>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
}> = ({ title, value, unit, icon, subtitle }) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-gray-500">{icon}</div>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold">
            {value}
            {unit && <span className="text-lg font-normal text-gray-500">{unit}</span>}
          </div>
          <p className="text-sm text-gray-600">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const AlertItem: React.FC<{ alert: Alert }> = ({ alert }) => {
  const severityConfig = {
    info: { bgColor: 'bg-info-50', borderColor: 'border-info-200', textColor: 'text-info-700' },
    warning: {
      bgColor: 'bg-warning-50',
      borderColor: 'border-warning-200',
      textColor: 'text-warning-700',
    },
    critical: {
      bgColor: 'bg-error-50',
      borderColor: 'border-error-200',
      textColor: 'text-error-700',
    },
  };

  const config = severityConfig[alert.severity];

  return (
    <div
      className={cn('p-4 rounded-lg border', config.bgColor, config.borderColor)}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                alert.severity === 'critical'
                  ? 'error'
                  : alert.severity === 'warning'
                  ? 'warning'
                  : 'default'
              }
            >
              {alert.severity.toUpperCase()}
            </Badge>
            <span className={cn('font-medium', config.textColor)}>{alert.ruleName}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
          <p className="text-xs text-gray-400 mt-2">
            Triggered: {new Date(alert.triggeredAt).toLocaleString()}
          </p>
        </div>
        {!alert.resolvedAt && !alert.acknowledged && (
          <Button variant="outline" size="sm">
            Acknowledge
          </Button>
        )}
        {alert.resolvedAt && (
          <Badge variant="outline" className="text-success-600">
            Resolved
          </Badge>
        )}
      </div>
    </div>
  );
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '< 1m';
};

export const MonitoringDashboard: React.FC = () => {
  const {
    data: health,
    isLoading,
    error,
    refetch,
  } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await api.get('/health');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      try {
        const response = await api.get('/alerts');
        return response.data?.alerts || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} className="rounded-lg" />
          ))}
        </div>
        <Skeleton height={300} className="rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <XCircle className="h-12 w-12 text-error-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Failed to load health data</h2>
        <p className="text-gray-600 mt-2">Please check if the API is running.</p>
        <Button onClick={() => refetch()} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!health) {
    return null;
  }

  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-600 mt-1">
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusIndicator status={health.status} />
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-500" />
            Active Alerts ({activeAlerts.length})
          </h2>
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Uptime"
          value={formatUptime(health.uptime)}
          icon={<Clock className="h-5 w-5" />}
          subtitle={`Version ${health.version}`}
        />
        <MetricCard
          title="Memory Usage"
          value={health.metrics.memory.heapUsedPercent}
          unit="%"
          icon={<Server className="h-5 w-5" />}
          subtitle={`${health.metrics.memory.heapUsed}MB / ${health.metrics.memory.heapTotal}MB`}
        />
        <MetricCard
          title="Request Count"
          value={health.metrics.requests.total.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
          subtitle={`${health.metrics.requests.errorRate.toFixed(2)}% error rate`}
        />
        <MetricCard
          title="Response Time (P95)"
          value={health.metrics.responseTime.p95}
          unit="ms"
          icon={<Clock className="h-5 w-5" />}
          subtitle={`Avg: ${health.metrics.responseTime.avg}ms`}
        />
      </div>

      {/* Services Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ServiceStatusCard name="Database (PostgreSQL)" service={health.services.database} />
            <ServiceStatusCard name="Cache (Redis)" service={health.services.redis} />
            <ServiceStatusCard name="NLP Service" service={health.services.nlp} />
          </div>
        </CardContent>
      </Card>

      {/* Response Time Details */}
      <Card>
        <CardHeader>
          <CardTitle>Response Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {health.metrics.responseTime.avg}
                <span className="text-sm font-normal text-gray-500">ms</span>
              </div>
              <div className="text-sm text-gray-600">Average</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {health.metrics.responseTime.p50}
                <span className="text-sm font-normal text-gray-500">ms</span>
              </div>
              <div className="text-sm text-gray-600">P50 (Median)</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {health.metrics.responseTime.p95}
                <span className="text-sm font-normal text-gray-500">ms</span>
              </div>
              <div className="text-sm text-gray-600">P95</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {health.metrics.responseTime.p99}
                <span className="text-sm font-normal text-gray-500">ms</span>
              </div>
              <div className="text-sm text-gray-600">P99</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Request Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {health.metrics.requests.total.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="text-2xl font-bold text-success-700">
                {health.metrics.requests.success.toLocaleString()}
              </div>
              <div className="text-sm text-success-600">Successful</div>
            </div>
            <div className="text-center p-4 bg-error-50 rounded-lg">
              <div className="text-2xl font-bold text-error-700">
                {health.metrics.requests.error.toLocaleString()}
              </div>
              <div className="text-sm text-error-600">Errors</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {health.metrics.requests.errorRate.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600">Error Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringDashboard;
