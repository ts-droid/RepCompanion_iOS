import { useEffect, useState } from "react";
import { Dumbbell, Sparkles, Target, Calendar, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const buildingSteps = [
  { text: "Analyserar dina mål...", icon: Target },
  { text: "Väljer övningar...", icon: Dumbbell },
  { text: "Optimerar schema...", icon: Calendar },
  { text: "Bygger ditt träningsprogram...", icon: Sparkles },
];

interface ProgramBuildingAnimationProps {
  onCancel?: () => void;
}

export default function ProgramBuildingAnimation({ onCancel }: ProgramBuildingAnimationProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [showCancelButton, setShowCancelButton] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % buildingSteps.length);
    }, 2000);

    // Show timeout message after 60 seconds
    const timeoutTimer = setTimeout(() => {
      setShowTimeoutMessage(true);
    }, 60000);

    // Show cancel button after 2 minutes (120 seconds)
    const cancelTimer = setTimeout(() => {
      setShowCancelButton(true);
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutTimer);
      clearTimeout(cancelTimer);
    };
  }, []);

  const currentStep = buildingSteps[stepIndex];
  const Icon = currentStep.icon;

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 max-w-md mx-auto">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Icon className="w-10 h-10 text-primary animate-bounce" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-6 h-6 text-primary animate-spin" style={{ animationDuration: '3s' }} />
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-foreground animate-pulse">
          {currentStep.text}
        </p>
        
        {!showTimeoutMessage ? (
          <p className="text-sm text-muted-foreground">
            Detta kan ta upp till 2 minuter. Ha lite tålamod...
          </p>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-4 py-3 rounded-lg border border-amber-500/20">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                Många tränar just nu – det tar lite längre tid än vanligt
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Din träningsplan genereras fortfarande. Vi uppskattar ditt tålamod!
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-center pt-2">
          {buildingSteps.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === stepIndex ? 'bg-primary w-6' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {showCancelButton && onCancel && (
          <div className="pt-6">
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full"
              data-testid="button-cancel-generation"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Avbryt och gå vidare
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
