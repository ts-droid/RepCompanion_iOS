import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, X, Play, Pause } from "lucide-react";

interface RestTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onSkip: () => void;
}

export function RestTimer({ duration, onComplete, onSkip }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeLeft, onComplete]);

  const progress = (timeLeft / duration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Vila</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Circular progress */}
          <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-secondary"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 88}`}
                strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
                className="text-primary transition-all duration-1000 ease-linear"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-bold">
                  {minutes}:{seconds.toString().padStart(2, "0")}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {timeLeft === 0 ? "Klart!" : "kvar"}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Fortsätt
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pausa
                </>
              )}
            </Button>
            <Button size="lg" className="flex-1" onClick={onSkip}>
              Hoppa över
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
