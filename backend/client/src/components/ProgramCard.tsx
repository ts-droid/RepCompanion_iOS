import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Dumbbell } from "lucide-react";

interface ProgramCardProps {
  title: string;
  phase: string;
  progress: number;
  totalPhases: number;
  exercises: number;
  moves: number;
  duration: string;
  image?: string;
  status?: "active" | "completed";
  onClick?: () => void;
}

export default function ProgramCard({
  title,
  phase,
  progress,
  totalPhases,
  exercises,
  moves,
  duration,
  image,
  status = "active",
  onClick
}: ProgramCardProps) {
  return (
    <Card 
      className="relative overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-transform"
      onClick={onClick}
      data-testid={`card-program-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="relative h-48 bg-gradient-to-br from-accent to-muted">
        {image && (
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover opacity-60"
          />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-foreground mb-1">{title}</div>
            <div className="text-[10px] text-muted-foreground">{phase}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">{progress}/{totalPhases}</div>
            <div className="text-[10px] text-muted-foreground">
              {status === "completed" ? "Completed" : "Kvar"}
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-2xl font-bold text-foreground mb-2">{phase}</div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-1">
              <Dumbbell className="w-3 h-3" />
              {exercises} övningar
            </div>
            <div>•</div>
            <div>{moves} MOVEs</div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="w-4 h-4" />
            {duration}
          </div>
        </div>
      </div>
    </Card>
  );
}
