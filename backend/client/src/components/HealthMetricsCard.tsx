import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Heart, Moon, TrendingUp, Footprints, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface HealthMetricsSummary {
  steps?: { value: number; unit: string; collectedAt: string };
  calories_burned?: { value: number; unit: string; collectedAt: string };
  active_minutes?: { value: number; unit: string; collectedAt: string };
  sleep_duration_minutes?: { value: number; unit: string; collectedAt: string };
  heart_rate_avg?: { value: number; unit: string; collectedAt: string };
  heart_rate_resting?: { value: number; unit: string; collectedAt: string };
  heart_rate_variability?: { value: number; unit: string; collectedAt: string };
  vo2_max?: { value: number; unit: string; collectedAt: string };
}

interface MetricDisplayProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  iconColor?: string;
}

function MetricDisplay({ icon, label, value, unit, iconColor = "text-primary" }: MetricDisplayProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className={`flex-shrink-0 ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground">
          {value}
          {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

export default function HealthMetricsCard() {
  const { data: metrics, isLoading } = useQuery<HealthMetricsSummary>({
    queryKey: ['/api/health/metrics/today'],
  });

  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ['/api/health/connections'],
  });

  const hasActiveConnection = connections.some(c => c.status === 'active');

  if (!hasActiveConnection) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Dagens hälsodata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = metrics && Object.keys(metrics).length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Dagens hälsodata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ingen data för idag ännu. Data synkas automatiskt från dina anslutna hälsoplattformar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-health-metrics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          Dagens hälsodata
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metrics.steps && (
          <MetricDisplay
            icon={<Footprints className="w-5 h-5" />}
            label="Steg"
            value={metrics.steps.value.toLocaleString('sv-SE')}
            iconColor="text-primary"
          />
        )}

        {metrics.calories_burned && (
          <MetricDisplay
            icon={<Flame className="w-5 h-5" />}
            label="Kalorier förbrända"
            value={metrics.calories_burned.value}
            unit="kcal"
            iconColor="text-orange-500"
          />
        )}

        {metrics.active_minutes && (
          <MetricDisplay
            icon={<Activity className="w-5 h-5" />}
            label="Aktiva minuter"
            value={metrics.active_minutes.value}
            unit="min"
            iconColor="text-green-500"
          />
        )}

        {metrics.sleep_duration_minutes && (
          <MetricDisplay
            icon={<Moon className="w-5 h-5" />}
            label="Sömn"
            value={(metrics.sleep_duration_minutes.value / 60).toFixed(1)}
            unit="timmar"
            iconColor="text-indigo-500"
          />
        )}

        {metrics.heart_rate_resting && (
          <MetricDisplay
            icon={<Heart className="w-5 h-5" />}
            label="Vilopuls"
            value={metrics.heart_rate_resting.value}
            unit="bpm"
            iconColor="text-red-500"
          />
        )}

        {metrics.heart_rate_variability && (
          <MetricDisplay
            icon={<TrendingUp className="w-5 h-5" />}
            label="HRV"
            value={metrics.heart_rate_variability.value}
            unit="ms"
            iconColor="text-cyan-500"
          />
        )}

        {metrics.vo2_max && (
          <MetricDisplay
            icon={<TrendingUp className="w-5 h-5" />}
            label="VO2 Max"
            value={metrics.vo2_max.value}
            unit="ml/kg/min"
            iconColor="text-purple-500"
          />
        )}

        <p className="text-xs text-muted-foreground text-center pt-2">
          Data synkas automatiskt från dina hälsoplattformar
        </p>
      </CardContent>
    </Card>
  );
}
