import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { formatExerciseWeight } from "@/lib/utils";

interface ExerciseListItemProps {
  name: string;
  category: string;
  sets: number;
  reps: number;
  weight?: number;
  image?: string;
  onClick?: () => void;
}

export default function ExerciseListItem({
  name,
  category,
  sets,
  reps,
  weight,
  image,
  onClick
}: ExerciseListItemProps) {
  return (
    <Card 
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`item-exercise-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-3">
        {image && (
          <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0 overflow-hidden">
            <img 
              src={image} 
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            {category}
          </div>
          <div className="font-semibold text-foreground mb-2">{name}</div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-foreground">{sets}</span>
              <span className="text-xs text-muted-foreground">serier</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-foreground">{reps}</span>
              <span className="text-xs text-muted-foreground">reps</span>
            </div>
            {weight && (
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-foreground">{formatExerciseWeight(weight, name)}</span>
              </div>
            )}
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </Card>
  );
}
