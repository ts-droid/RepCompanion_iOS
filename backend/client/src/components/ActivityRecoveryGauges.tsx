import { useEffect, useState } from "react";
import { Activity, Heart, Target, Clock, Footprints, Moon, Activity as ActivityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewMode = "combined" | "activity" | "recovery";

interface ActivityRecoveryGaugesProps {
  activityPercent: number;
  recoveryPercent: number;
  // Activity details (from Apple Health)
  stepGoal?: number;
  stepsCurrent?: number;
  trainingPulseMinutes?: number;
  activeCalories?: number;
  // Recovery details (from Apple Health)
  sleepHours?: number;
  hrv?: number;
  restingHeartRate?: number;
}

export default function ActivityRecoveryGauges({ 
  activityPercent, 
  recoveryPercent,
  stepGoal = 10000,
  stepsCurrent = 7500,
  trainingPulseMinutes = 45,
  activeCalories = 450,
  sleepHours = 7.5,
  hrv = 65,
  restingHeartRate = 58,
}: ActivityRecoveryGaugesProps) {
  const [animatedActivity, setAnimatedActivity] = useState(0);
  const [animatedRecovery, setAnimatedRecovery] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedActivity(activityPercent);
      setAnimatedRecovery(recoveryPercent);
    }, 100);
    return () => clearTimeout(timer);
  }, [activityPercent, recoveryPercent]);

  // Circular progress calculation
  const radius = 60;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  const activityStrokeDashoffset = circumference - (animatedActivity / 100) * circumference;
  const recoveryStrokeDashoffset = circumference - (animatedRecovery / 100) * circumference;

  // Helper to render circular meter
  const renderMeter = (
    type: "activity" | "recovery",
    percent: number,
    animatedPercent: number,
    strokeDashoffset: number
  ) => {
    const isActivity = type === "activity";
    const Icon = isActivity ? Activity : Heart;
    const color = isActivity ? "hsl(var(--primary))" : "hsl(var(--accent))";
    const label = isActivity ? "Aktivitet" : "Återhämtning";
    const sublabel = isActivity ? "av mål" : "optimal";
    
    return (
      <div 
        className="flex flex-col items-center justify-center bg-card/50 backdrop-blur-sm border border-card-border rounded-2xl p-6"
        data-testid={`gauge-${type}`}
      >
        <div className="text-sm font-semibold text-muted-foreground mb-4 tracking-wider uppercase">
          {label}
        </div>
        
        <div className="relative w-32 h-32">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="transform -rotate-90"
          >
            <circle
              stroke="hsl(var(--muted) / 0.3)"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke={color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              style={{
                transition: 'stroke-dashoffset 1.5s ease-in-out',
              }}
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon className={`w-6 h-6 mb-1 ${isActivity ? 'text-primary' : 'text-accent'}`} data-testid={`icon-${type}`} />
            <div className="text-2xl font-bold text-foreground" data-testid={`text-${type}-percent`}>
              {Math.round(animatedPercent)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5" data-testid={`text-${type}-label`}>
              {sublabel}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="flex gap-2 px-4">
        <Button
          variant={viewMode === "combined" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("combined")}
          data-testid="button-view-combined"
          className="flex-1"
        >
          Kombinerad
        </Button>
        <Button
          variant={viewMode === "activity" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("activity")}
          data-testid="button-view-activity"
          className="flex-1"
        >
          <Activity className="w-4 h-4 mr-1" />
          Aktivitet
        </Button>
        <Button
          variant={viewMode === "recovery" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("recovery")}
          data-testid="button-view-recovery"
          className="flex-1"
        >
          <Heart className="w-4 h-4 mr-1" />
          Återhämtning
        </Button>
      </div>

      {/* Combined View */}
      {viewMode === "combined" && (
        <div className="grid grid-cols-2 gap-6 py-6 px-4">
          {renderMeter("activity", activityPercent, animatedActivity, activityStrokeDashoffset)}
          {renderMeter("recovery", recoveryPercent, animatedRecovery, recoveryStrokeDashoffset)}
        </div>
      )}

      {/* Activity Detail View */}
      {viewMode === "activity" && (
        <div className="px-4 py-6 space-y-6">
          <div className="flex justify-center">
            {renderMeter("activity", activityPercent, animatedActivity, activityStrokeDashoffset)}
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-card-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground tracking-wider uppercase mb-3">
              Aktivitetsdetaljer
            </h3>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Steg idag</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground" data-testid="text-steps-current">
                  {stepsCurrent.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-steps-goal">
                  av {stepGoal.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Träningspuls</span>
              </div>
              <div className="text-sm font-semibold text-foreground" data-testid="text-training-pulse-minutes">
                {trainingPulseMinutes} min
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Aktiva kalorier</span>
              </div>
              <div className="text-sm font-semibold text-foreground" data-testid="text-active-calories">
                {activeCalories} kcal
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Detail View */}
      {viewMode === "recovery" && (
        <div className="px-4 py-6 space-y-6">
          <div className="flex justify-center">
            {renderMeter("recovery", recoveryPercent, animatedRecovery, recoveryStrokeDashoffset)}
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-card-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground tracking-wider uppercase mb-3">
              Återhämtningsdetaljer
            </h3>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sömn (senaste natten)</span>
              </div>
              <div className="text-sm font-semibold text-foreground" data-testid="text-sleep-hours">
                {sleepHours} h
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">HRV</span>
              </div>
              <div className="text-sm font-semibold text-foreground" data-testid="text-hrv">
                {hrv} ms
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Vilopuls</span>
              </div>
              <div className="text-sm font-semibold text-foreground" data-testid="text-resting-heart-rate">
                {restingHeartRate} bpm
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
