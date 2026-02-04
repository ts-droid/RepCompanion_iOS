import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Timer, SkipForward } from "lucide-react";

interface RestTimerProps {
  restTime: number;
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function RestTimer({ restTime, onComplete, onSkip }: RestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(restTime);
  const [isRunning, setIsRunning] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    setTimeRemaining(restTime);
    setIsRunning(true);
    setHasCompleted(false);
  }, [restTime]);

  useEffect(() => {
    if (!isRunning || hasCompleted) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setHasCompleted(true);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, hasCompleted, onComplete]);

  const handleSkip = useCallback(() => {
    setIsRunning(false);
    onSkip?.();
  }, [onSkip]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const safeRestTime = restTime > 0 ? restTime : 1;
  const progressPercentage = ((safeRestTime - timeRemaining) / safeRestTime) * 100;

  return (
    <Card className="w-full" data-testid="card-rest-timer">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Timer className="w-5 h-5" />
          <span className="text-sm font-medium">Vilotid</span>
        </div>

        <div className="text-center">
          <div className="text-6xl font-bold tabular-nums text-foreground" data-testid="text-time-remaining">
            {formatTime(timeRemaining)}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {timeRemaining > 0 ? "sekunder kvar" : "Redo!"}
          </div>
        </div>

        <Progress value={progressPercentage} className="h-2" data-testid="progress-timer" />

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleSkip}
          data-testid="button-skip-rest"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Hoppa över
        </Button>
      </CardContent>
    </Card>
  );
}
