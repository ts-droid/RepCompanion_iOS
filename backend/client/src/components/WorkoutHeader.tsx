import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";

interface WorkoutHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  duration?: string;
  category?: string;
}

export default function WorkoutHeader({ 
  title, 
  subtitle, 
  onBack,
  duration,
  category
}: WorkoutHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center gap-3 p-4">
        {onBack && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
          {subtitle && (
            <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
      </div>
      
      {(category || duration) && (
        <div className="px-4 pb-3 flex gap-2">
          {category && (
            <div className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-semibold">
              {category}
            </div>
          )}
          {duration && (
            <div className="px-3 py-1 bg-secondary rounded-full text-xs font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duration}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
