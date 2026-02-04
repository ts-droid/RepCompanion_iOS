import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trophy, Clock, Dumbbell, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PromoCard } from "@/components/PromoCard";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import confetti from "canvas-confetti";
import celebrationGif from "@assets/Celebration Colorful GIF_1763669703451.gif";
import type { WorkoutSession, ExerciseLog, ProgramTemplate, ProgramTemplateExercise } from "@shared/schema";

type TemplateWithExercises = ProgramTemplate & {
  exercises: ProgramTemplateExercise[];
};

export default function SessionComplete() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [showConfetti, setShowConfetti] = useState(true);
  const [confettiTriggered, setConfettiTriggered] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("id");

  const { data: session } = useQuery<WorkoutSession>({
    queryKey: ["/api/sessions", sessionId],
    enabled: !!sessionId,
  });

  const { data: exercises } = useQuery<ExerciseLog[]>({
    queryKey: ["/api/sessions", sessionId, "exercises"],
    enabled: !!sessionId,
  });

  const { data: program, isError: programError, isLoading: programLoading } = useQuery<TemplateWithExercises>({
    queryKey: ["/api/program", session?.templateId],
    enabled: !!session?.templateId,
  });

  // Validate that all planned exercises and sets are completed
  const validateCompletion = (
    currentSession: WorkoutSession,
    currentExercises: ExerciseLog[]
  ) => {
    // If session has no template, it's always complete (free-form workout)
    if (!currentSession.templateId) {
      return { isComplete: true, missingExercises: [] };
    }

    // If template fetch failed (deleted template), allow completion with existing logs
    if (programError) {
      return { isComplete: true, missingExercises: [], templateDeleted: true };
    }

    // If we're still loading template data, wait for it
    if (programLoading || !program) {
      return { isComplete: false, missingExercises: [], isLoading: true };
    }

    const missingExercises: Array<{ title: string; plannedSets: number; completedSets: number }> = [];

    // Match exercises by exerciseOrderIndex (position in template) for accuracy
    program.exercises.forEach((plannedEx: ProgramTemplateExercise, index: number) => {
      const completedLogs = currentExercises.filter(
        log => log.exerciseOrderIndex === index && log.completed === true
      );
      const completedSets = completedLogs.length;
      const plannedSets = plannedEx.targetSets;

      if (completedSets < plannedSets) {
        missingExercises.push({
          title: plannedEx.exerciseName,
          plannedSets,
          completedSets,
        });
      }
    });

    return {
      isComplete: missingExercises.length === 0,
      missingExercises,
    };
  };

  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      // First complete the session (which now syncs to Vital API automatically)
      const result = await apiRequest("POST", `/api/sessions/${sessionId}/complete`, { notes });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/next"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/progress"] });
      toast({
        title: "Bra jobbat!",
        description: "Ditt träningspass är sparat och synkad med Apple Health",
      });
      setTimeout(() => setLocation("/"), 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Fel vid sparning",
        description: error.message || "Kunde inte slutföra träningspasset. Försök igen.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!sessionId) {
      setLocation("/");
      return;
    }
  }, [sessionId]);

  // Trigger epic confetti celebration ONCE when validation completes successfully
  // MUST be before early return to satisfy Rules of Hooks
  // Note: Celebration sound is played in ActiveSession on button click (user gesture)
  useEffect(() => {
    // Guard: only run if data is loaded
    if (!session || !exercises) return;

    const validation = validateCompletion(session, exercises);
    
    if (!validation.isComplete || validation.isLoading || confettiTriggered) return;

    setConfettiTriggered(true);

    // Fire confetti from multiple angles
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        setShowConfetti(false);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Fire from left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      // Fire from right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [session, exercises, confettiTriggered, program, programError, programLoading]);

  if (!session || !exercises) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laddar resultat...</p>
        </div>
      </div>
    );
  }

  // Run validation after loading guard ensures session and exercises exist
  const validation = validateCompletion(session, exercises);

  const totalExercises = new Set(exercises.map(e => e.exerciseTitle)).size;
  const totalSets = exercises.length;
  const totalReps = exercises.reduce((sum, e) => sum + (e.reps || 0), 0);
  const totalWeight = exercises.reduce((sum, e) => sum + (e.weight || 0) * (e.reps || 0), 0);
  
  const sessionStart = new Date(session.startedAt);
  const sessionEnd = session.completedAt ? new Date(session.completedAt) : new Date();
  const duration = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000 / 60);

  return (
    <div className="min-h-screen bg-background pb-8 overflow-x-hidden w-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="p-6 text-center w-full">
          {validation.isLoading ? (
            <>
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <h1 className="text-2xl font-bold text-foreground">Validerar...</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Kontrollerar att alla övningar är genomförda
              </p>
            </>
          ) : validation.isComplete ? (
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-20 h-20 text-primary/20 animate-pulse" />
              </div>
              <img 
                src={celebrationGif} 
                alt="Celebration" 
                className="w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-4 relative z-10" 
                data-testid="img-celebration-gif"
              />
              <Trophy className={`w-16 h-16 text-primary mx-auto mb-3 relative z-10 ${showConfetti ? 'animate-bounce' : ''}`} />
              <h1 className="text-3xl font-bold text-foreground mb-2">Bra jobbat!</h1>
              <p className="text-base text-muted-foreground">
                Du har genomfört ditt träningspass
              </p>
            </div>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
              <h1 className="text-2xl font-bold text-foreground">Passet är inte klart</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Det finns övningar som inte är genomförda
              </p>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 space-y-4 w-full max-w-full">
        <Card data-testid="card-session-stats">
          <CardHeader>
            <CardTitle className="text-lg">Sammanfattning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{duration}</p>
                  <p className="text-xs text-muted-foreground">minuter</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalExercises}</p>
                  <p className="text-xs text-muted-foreground">övningar</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalSets}</p>
                  <p className="text-xs text-muted-foreground">set</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalWeight.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">kg total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!validation.isComplete && !validation.isLoading && (
          <Card data-testid="card-missing-exercises" className="border-destructive">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Saknade övningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Följande övningar är inte fullständigt genomförda:
              </p>
              <div className="space-y-2">
                {validation.missingExercises.map((ex, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between items-center p-3 rounded-lg bg-destructive/10"
                    data-testid={`missing-exercise-${idx}`}
                  >
                    <span className="text-sm font-medium">{ex.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {ex.completedSets}/{ex.plannedSets} set klara
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {validation.isComplete && (
          <>
            <Card data-testid="card-session-notes">
              <CardHeader>
                <CardTitle className="text-base">Anteckningar (valfritt)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Hur kändes passet? Något att komma ihåg till nästa gång?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-notes"
                />
              </CardContent>
            </Card>

            <PromoCard placement="workout_complete" />
          </>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            if (validation.isComplete) {
              completeSessionMutation.mutate();
            } else if (!validation.isLoading) {
              setLocation(`/session/active?sessionId=${sessionId}`);
            }
          }}
          disabled={validation.isLoading || (validation.isComplete && completeSessionMutation.isPending)}
          data-testid="button-finish-session"
          variant={validation.isComplete ? "default" : "outline"}
        >
          {validation.isLoading 
            ? "Validerar..."
            : validation.isComplete 
              ? (completeSessionMutation.isPending ? "Sparar..." : "Slutför träningspass")
              : "Fortsätt träna"}
        </Button>
      </div>
    </div>
  );
}
