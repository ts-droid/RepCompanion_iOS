import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Flame, Activity, TrendingUp, Lock } from "lucide-react";

interface HealthPermissionCardProps {
  onAllow?: () => void;
  onDeny?: () => void;
}

export default function HealthPermissionCard({ onAllow, onDeny }: HealthPermissionCardProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6">
      <div className="w-full max-w-md flex-1 flex flex-col">
        <div className="h-1 bg-primary/30 rounded-full mb-8">
          <div className="h-full w-full bg-primary rounded-full" />
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-card rounded-3xl flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-destructive fill-destructive" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">Hälsoåtkomst</h1>
          <p className="text-muted-foreground mb-8 max-w-sm">
            "HiFuture Ring" vill kunna läsa och uppdatera dina hälsodata.
          </p>
          
          <div className="w-full space-y-3 mb-8">
            <div className="flex items-center gap-3 text-left">
              <Flame className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">Energi vid aktivitet</span>
            </div>
            <div className="flex items-center gap-3 text-left">
              <Activity className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">Gång- och löpdistans</span>
            </div>
            <div className="flex items-center gap-3 text-left">
              <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">Steg</span>
            </div>
          </div>
          
          <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-sm">
            <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-left">
              Appens förklaring: Require your consent to access Health Update.
            </p>
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-md space-y-3">
        <Button 
          className="w-full h-12 text-base font-semibold"
          onClick={onAllow}
          data-testid="button-allow-health"
        >
          Tillåt
        </Button>
        <Button 
          variant="ghost" 
          className="w-full h-12 text-base font-semibold"
          onClick={onDeny}
          data-testid="button-deny-health"
        >
          Tillåt inte
        </Button>
      </div>
    </div>
  );
}
