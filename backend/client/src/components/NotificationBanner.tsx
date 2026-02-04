import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Droplet, 
  Flame, 
  AlertTriangle, 
  Utensils, 
  Target, 
  Heart, 
  Dumbbell,
  type LucideIcon
} from "lucide-react";

interface NotificationBannerProps {
  message: string;
  icon?: string;
  onDismiss?: () => void;
}

// Map icon strings to Lucide React components
const iconMap: Record<string, LucideIcon> = {
  droplet: Droplet,
  flame: Flame,
  "alert-triangle": AlertTriangle,
  utensils: Utensils,
  target: Target,
  heart: Heart,
  dumbbell: Dumbbell,
};

export default function NotificationBanner({ 
  message, 
  icon = "dumbbell", 
  onDismiss 
}: NotificationBannerProps) {
  // Get the icon component or use default (normalize to lowercase for lookup)
  const iconKey = icon ? icon.toLowerCase() : "dumbbell";
  const IconComponent = iconMap[iconKey] || iconMap.dumbbell;
  
  return (
    <Card className="p-4 bg-accent/50 border-accent-foreground/20">
      <div className="flex items-start gap-3">
        <div className="text-primary flex-shrink-0">
          <IconComponent className="w-6 h-6" />
        </div>
        <p className="flex-1 text-sm text-foreground leading-relaxed">
          {message}
        </p>
        {onDismiss && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            className="flex-shrink-0 h-6 w-6"
            data-testid="button-dismiss-notification"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
