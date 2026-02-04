import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Loader2, Dumbbell, Zap, Target, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const generationSteps = [
  { progress: 0, message: "Analyserar din profil..." },
  { progress: 20, message: "Identifierar tillgänglig utrustning..." },
  { progress: 35, message: "Väljer optimala övningar..." },
  { progress: 50, message: "Skapar träningsstruktur..." },
  { progress: 65, message: "Balanserar träningsvolym..." },
  { progress: 80, message: "Optimerar progressionsplan..." },
  { progress: 95, message: "Finaliserar ditt program..." },
  { progress: 100, message: "Klart!" }
];

export default function ProgramGenerating() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;
    let timeoutTimer: NodeJS.Timeout;
    
    // Simulate progress through steps
    const stepDuration = 30000; // 30 seconds per step (total ~4 minutes for 8 steps)
    interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < generationSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, stepDuration);

    // Timeout after 6 minutes (360000ms) - this is a one-time timer
    timeoutTimer = setTimeout(() => {
      clearInterval(interval);
      clearInterval(pollInterval);
      setHasError(true);
      toast({
        title: "Timeout",
        description: "Programgenereringen tog för lång tid. Försök igen senare.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/profile"), 3000);
    }, 360000);

    // Poll for completion - check if program generation is done
    pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/program/templates");
        if (response.ok) {
          const templates = await response.json();
          // If we have templates, consider it done (no artificial delay)
          if (templates && templates.length > 0) {
            clearInterval(interval);
            clearInterval(pollInterval);
            clearTimeout(timeoutTimer);
            setCurrentStep(generationSteps.length - 1);
            setIsComplete(true);
            
            setTimeout(() => {
              toast({
                title: "Träningsprogram klart! 🎉",
                description: `${templates.length} träningspass har skapats åt dig.`,
              });
              setLocation("/?tab=programs");
            }, 1500);
          }
        }
      } catch (error) {
        console.error("Error checking program status:", error);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
      clearTimeout(timeoutTimer);
    };
  }, [setLocation, toast]);

  const currentProgress = generationSteps[currentStep]?.progress || 0;
  const currentMessage = generationSteps[currentStep]?.message || "Bearbetar...";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Icon animation */}
        <div className="flex justify-center">
          <div className="relative">
            {!hasError && <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />}
            <div className={`relative p-8 rounded-full ${hasError ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              {hasError ? (
                <AlertCircle className="w-16 h-16 text-destructive" />
              ) : isComplete ? (
                <Target className="w-16 h-16 text-primary" />
              ) : (
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-generating-title">
            {hasError ? "Timeout" : isComplete ? "Program klart!" : "Bygger ditt träningsprogram"}
          </h1>
          <p className="text-muted-foreground">
            {hasError 
              ? "Programgenereringen tog för lång tid. Omdirigerar snart..."
              : "Detta tar vanligtvis 3-5 minuter"
            }
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-3">
          <Progress 
            value={currentProgress} 
            className="h-3"
            data-testid="progress-generation"
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{currentProgress}%</span>
            <span className="text-muted-foreground">100%</span>
          </div>
        </div>

        {/* Current status */}
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-5 h-5 text-primary" />
            <p className="font-medium" data-testid="text-current-step">
              {currentMessage}
            </p>
          </div>

          {/* Step indicators */}
          <div className="space-y-2">
            {generationSteps.slice(0, currentStep + 1).map((step, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Zap className="w-3 h-3" />
                <span className={index === currentStep ? "text-foreground font-medium" : ""}>
                  {step.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info message */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Vi använder AI för att skapa ett personligt anpassat program
            baserat på dina mål, nivå och tillgänglig utrustning.
          </p>
        </div>
      </div>
    </div>
  );
}
