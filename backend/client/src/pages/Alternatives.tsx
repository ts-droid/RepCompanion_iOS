import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserProfile, UserEquipment, Gym } from "@shared/schema";

interface AlternativeExercise {
  title: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: string;
  description: string;
}

interface ExerciseWithAlternatives {
  exerciseKey: string;
  original: any;
  alternatives: AlternativeExercise[];
  selectedAlternative: AlternativeExercise | null;
  loading: boolean;
}

export default function Alternatives() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [exercises, setExercises] = useState<ExerciseWithAlternatives[]>([]);

  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const exerciseKeys = queryParams.get('exercises')?.split(',') || [];

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: equipment } = useQuery<UserEquipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: gyms } = useQuery<Gym[]>({
    queryKey: ["/api/gyms"],
  });

  const activeGym = gyms?.find(g => g.id === profile?.selectedGymId);
  const activeGymId = activeGym?.id;
  const availableEquipment = equipment?.filter(e => e.gymId === activeGymId) || [];

  useEffect(() => {
    if (!profile?.aiProgramData || exerciseKeys.length === 0) return;

    const programData = profile.aiProgramData as any;
    const originalExercises = exerciseKeys.map(key => {
      let found: any = null;
      
      programData.phases?.forEach((phase: any) => {
        phase.sessions?.forEach((session: any) => {
          session.exercises?.forEach((exercise: any) => {
            if (exercise.key === key || 
                `${exercise.title}-${exercise.muscleGroups?.[0]}` === key) {
              found = { ...exercise, sessionName: session.name };
            }
          });
        });
      });

      return found;
    }).filter(Boolean);

    setExercises(originalExercises.map(ex => ({
      exerciseKey: ex.key || `${ex.title}-${ex.muscleGroups?.[0]}`,
      original: ex,
      alternatives: [],
      selectedAlternative: null,
      loading: false,
    })));
  }, [profile, exerciseKeys.join(',')]);

  const suggestAlternativesMutation = useMutation({
    mutationFn: async (data: { 
      originalExercise: any; 
      targetMuscleGroups: string[]; 
      availableEquipment: UserEquipment[];
    }) => {
      const res = await apiRequest("POST", "/api/workouts/suggest-alternative", data);
      return res.json();
    },
  });

  const handleGetAlternatives = async (index: number) => {
    const exercise = exercises[index];
    if (!exercise) return;

    setExercises(prev => prev.map((ex, i) => 
      i === index ? { ...ex, loading: true } : ex
    ));

    try {
      const result = await suggestAlternativesMutation.mutateAsync({
        originalExercise: exercise.original,
        targetMuscleGroups: exercise.original.muscleGroups || [],
        availableEquipment,
      });

      setExercises(prev => prev.map((ex, i) => 
        i === index ? { 
          ...ex, 
          alternatives: result.alternatives || [], 
          loading: false 
        } : ex
      ));

      toast({
        title: "Alternativ hittade",
        description: `${result.alternatives?.length || 0} alternativa övningar föreslagna`,
      });
    } catch (error) {
      setExercises(prev => prev.map((ex, i) => 
        i === index ? { ...ex, loading: false } : ex
      ));
      
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta AI-alternativ",
        variant: "destructive",
      });
    }
  };

  const handleSelectAlternative = (exerciseIndex: number, alternativeIndex: number) => {
    setExercises(prev => prev.map((ex, i) => 
      i === exerciseIndex ? { 
        ...ex, 
        selectedAlternative: ex.alternatives[alternativeIndex] 
      } : ex
    ));
  };

  const handleApplyChanges = async () => {
    toast({
      title: "Ändringar sparade",
      description: "Ditt träningsprogram har uppdaterats",
    });
    setLocation("/");
  };

  if (!profile?.aiProgramData || exerciseKeys.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center gap-4 p-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLocation("/gyms")}
              className="rounded-full"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">AI Alternativ</h1>
          </div>
        </div>
        <div className="p-4">
          <Alert>
            <AlertDescription>
              Inga övningar valda eller AI-program saknas
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/gyms")}
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">AI Alternativ</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Alert>
          <AlertDescription>
            <p className="font-semibold mb-2">Saknad utrustning upptäckt</p>
            <p className="text-sm">Få AI-förslag på alternativa övningar som du kan utföra med tillgänglig utrustning.</p>
          </AlertDescription>
        </Alert>

        {exercises.map((exercise, exerciseIndex) => (
          <Card key={exerciseIndex} data-testid={`card-exercise-${exerciseIndex}`}>
            <CardHeader>
              <CardTitle>{exercise.original.title}</CardTitle>
              <CardDescription>
                {exercise.original.sessionName && `${exercise.original.sessionName} • `}
                {exercise.original.muscleGroups?.join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Kräver:</p>
                <div className="flex flex-wrap gap-2">
                  {exercise.original.equipment?.map((eq: string, idx: number) => (
                    <Badge key={idx} variant="outline">{eq}</Badge>
                  ))}
                </div>
              </div>

              {exercise.alternatives.length === 0 && !exercise.loading && (
                <Button
                  className="w-full"
                  onClick={() => handleGetAlternatives(exerciseIndex)}
                  data-testid={`button-get-alternatives-${exerciseIndex}`}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Få AI-Alternativ
                </Button>
              )}

              {exercise.loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              {exercise.alternatives.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Föreslagna alternativ:</p>
                  {exercise.alternatives.map((alt, altIndex) => (
                    <button
                      key={altIndex}
                      onClick={() => handleSelectAlternative(exerciseIndex, altIndex)}
                      className={`w-full text-left p-4 rounded-lg border hover-elevate active-elevate-2 ${
                        exercise.selectedAlternative === alt
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-card-border"
                      }`}
                      data-testid={`button-select-alternative-${exerciseIndex}-${altIndex}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{alt.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{alt.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {alt.equipment.map((eq, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">{eq}</Badge>
                            ))}
                          </div>
                        </div>
                        {exercise.selectedAlternative === alt && (
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {exercises.some(ex => ex.selectedAlternative) && (
          <Button
            className="w-full"
            onClick={handleApplyChanges}
            data-testid="button-apply-changes"
          >
            <Check className="w-4 h-4 mr-2" />
            Tillämpa Ändringar ({exercises.filter(ex => ex.selectedAlternative).length})
          </Button>
        )}
      </div>
    </div>
  );
}
