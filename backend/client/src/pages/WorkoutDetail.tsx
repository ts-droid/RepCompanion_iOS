import { useState } from "react";
import WorkoutHeader from "@/components/WorkoutHeader";
import CategoryPill from "@/components/CategoryPill";
import ExerciseListItem from "@/components/ExerciseListItem";
import BottomNav from "@/components/BottomNav";

export default function WorkoutDetail() {
  const [activeTab, setActiveTab] = useState("programs");

  return (
    <div className="min-h-screen bg-background pb-20">
      <WorkoutHeader
        title="STRENGTH TRAINING"
        subtitle="Chest Press Sel, Vertical Traction Sel, Lower Back Sel"
        onBack={() => console.log("Back clicked")}
        category="Styrka"
        duration="16 min"
      />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <CategoryPill label="Styrka" active />
          <CategoryPill label="10 min" />
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm mb-3">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
              🔗
            </div>
            <span className="text-foreground font-medium">Leg Press Sel, Leg Extension Sel</span>
          </div>
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground mb-3">Uppdelning</h3>
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Övningslista</h4>
            <div className="space-y-3">
              <ExerciseListItem
                name="Benpress"
                category="LEG PRESS SEL"
                sets={4}
                reps={8}
                weight={90}
                onClick={() => console.log("Exercise clicked")}
              />
              <ExerciseListItem
                name="Extension båda benen"
                category="LEG EXTENSION SEL"
                sets={3}
                reps={10}
                weight={37.5}
                onClick={() => console.log("Exercise clicked")}
              />
            </div>
          </div>
        </div>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
