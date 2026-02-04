import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronUp, ChevronDown, Play, Calendar, PlayCircle, Plus, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProgramTemplate, ProgramTemplateExercise, UserProfile } from "@shared/schema";
import { getDayName, normalizeTestId } from "@/lib/utils";
import { VideoPlayerDialog } from "@/components/VideoPlayerDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type TemplateWithExercises = ProgramTemplate & { exercises: ProgramTemplateExercise[] };

function ExerciseVideoButton({ 
  exerciseName, 
  youtubeUrl, 
  videoType 
}: { 
  exerciseName: string; 
  youtubeUrl: string | null; 
  videoType: string | null;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!youtubeUrl) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogOpen(true);
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0"
        onClick={handleClick}
        data-testid={`button-video-${normalizeTestId(exerciseName)}`}
      >
        <PlayCircle className="w-4 h-4 text-primary" />
      </Button>

      <VideoPlayerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        exerciseName={exerciseName}
        youtubeUrl={youtubeUrl}
        videoType={videoType}
      />
    </>
  );
}

export default function EditProgram() {
  const [, params] = useRoute("/edit-program/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const templateId = params?.id;

  const [exercises, setExercises] = useState<ProgramTemplateExercise[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: template, isLoading } = useQuery<TemplateWithExercises>({
    queryKey: ["/api/program", templateId],
    queryFn: async () => {
      if (!templateId) throw new Error("Template ID required");
      const res = await fetch(`/api/program/${templateId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
    enabled: !!templateId,
  });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: templatesData } = useQuery<Array<{ template: ProgramTemplate; exerciseCount: number; isNext: boolean }>>({
    queryKey: ["/api/program/templates"],
  });

  const exerciseNames = useMemo(() => {
    return exercises.map(e => e.exerciseName).sort();
  }, [exercises]);

  const { data: exerciseVideos } = useQuery<Record<string, { youtubeUrl: string | null; videoType: string | null }>>({
    queryKey: ["/api/exercises/videos", exerciseNames.join("|")],
    queryFn: async () => {
      if (exerciseNames.length === 0) return {};
      const params = new URLSearchParams();
      exerciseNames.forEach(name => params.append("names", name));
      const response = await fetch(`/api/exercises/videos?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        console.error("Failed to fetch exercise videos:", response.status);
        return {};
      }
      return await response.json();
    },
    enabled: exerciseNames.length > 0,
  });

  const { data: availableExercises = [] } = useQuery<any[]>({
    queryKey: [`/api/exercises/for-template/${templateId}`],
    enabled: showAddExercise && !!templateId,
  });

  const isNextTemplate = templatesData?.find(t => t.template.id === templateId)?.isNext || false;

  useEffect(() => {
    if (template?.exercises) {
      setExercises(template.exercises);
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sanitizedExercises = exercises.map(ex => ({
        id: ex.id,
        orderIndex: ex.orderIndex,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
      }));
      return await apiRequest("PATCH", `/api/program/templates/${templateId}`, { exercises: sanitizedExercises });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program", templateId] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/templates"] });
      toast({
        title: "Ändringar sparade!",
        description: "Ditt träningspass har uppdaterats",
      });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte spara ändringar",
        variant: "destructive",
      });
    },
  });

  const updateDayMutation = useMutation({
    mutationFn: async (dayOfWeek: number) => {
      return await apiRequest("PATCH", `/api/program/${templateId}/meta`, { dayOfWeek });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program", templateId] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/next"] });
      toast({
        title: "Dag uppdaterad!",
        description: "Träningsdagen har ändrats",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte ändra dag",
        variant: "destructive",
      });
    },
  });

  const moveExercise = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === exercises.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    // Create new array with swapped exercises
    const newExercises = [...exercises];
    [newExercises[index], newExercises[targetIndex]] = [newExercises[targetIndex], newExercises[index]];
    
    // Re-index all exercises to match their new positions
    const reindexedExercises = newExercises.map((ex, idx) => ({
      ...ex,
      orderIndex: idx,
    }));
    
    setExercises(reindexedExercises);
    setHasChanges(true);
  };

  const removeExercise = (index: number) => {
    const newExercises = exercises.filter((_, idx) => idx !== index);
    // Re-index remaining exercises
    const reindexedExercises = newExercises.map((ex, idx) => ({
      ...ex,
      orderIndex: idx,
    }));
    setExercises(reindexedExercises);
    setHasChanges(true);
  };

  const addExerciseMutation = useMutation({
    mutationFn: async (exerciseName: string) => {
      const response = await apiRequest("POST", `/api/program/templates/${templateId}/exercises`, {
        exerciseName,
        targetSets: 3,
        targetReps: 8,
      });
      return await response.json() as ProgramTemplateExercise;
    },
    onSuccess: (newExercise: ProgramTemplateExercise) => {
      setExercises([...exercises, newExercise]);
      setHasChanges(true);
      setShowAddExercise(false);
      setSearchTerm("");
      toast({
        title: "Övning tillagd!",
        description: `${newExercise.exerciseName} har lagts till i passet`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte lägga till övningen",
        variant: "destructive",
      });
    },
  });

  const filteredExercises = availableExercises.filter(ex =>
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateExercise = (index: number, field: keyof ProgramTemplateExercise, value: any) => {
    const newExercises = exercises.map((ex, idx) => 
      idx === index ? { ...ex, [field]: value } : ex
    );
    setExercises(newExercises);
    setHasChanges(true);
  };

  const extractMinReps = (reps: string | number): number => {
    if (typeof reps === "number") return reps;
    
    const repsStr = reps.toString().trim();
    
    // If it's a range (e.g., "8-12"), extract the first number
    if (repsStr.includes("-")) {
      const parts = repsStr.split("-").map(s => parseInt(s.trim()));
      if (parts.length >= 1 && !isNaN(parts[0])) {
        return parts[0];
      }
    }
    
    // If it's a single number, extract it
    const cleaned = repsStr.replace(/[^\d]/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) ? 8 : num; // Default to 8 if unparseable
  };



  // Calculate estimated total time using AI's duration (if available) or fallback to calculation
  const calculateTotalTime = () => {
    if (!exercises.length) return 0;
    
    // Use AI's estimate (1.5 min/set + warmup/cooldown) if available
    if (template?.estimatedDurationMinutes && !hasChanges) {
      return template.estimatedDurationMinutes;
    }
    
    // Fallback: Calculate based on sets (used when user modifies the program)
    // Formula: (total_sets × 1.5 min) + 10 min warmup + 8 min cooldown
    const totalSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
    const estimatedTime = Math.round((totalSets * 1.5) + 18);
    
    return estimatedTime;
  };

  const totalTime = calculateTotalTime();
  const sessionDuration = profile?.sessionDuration || 60;
  const maxAcceptableTime = Math.ceil(sessionDuration * 1.1); // +10% tolerance
  const exceedsTime = totalTime > maxAcceptableTime;

  const startSession = () => {
    if (!templateId) return;
    setLocation(`/warmup?templateId=${templateId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Laddar pass...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Pass hittades inte</p>
          <Button onClick={() => setLocation("/")} data-testid="button-back-to-dashboard">
            Tillbaka till Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/")}
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{template.muscleFocus || template.templateName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Select
                value={template.dayOfWeek?.toString() || ""}
                onValueChange={(value) => updateDayMutation.mutate(parseInt(value))}
                disabled={updateDayMutation.isPending || !template.dayOfWeek}
              >
                <SelectTrigger 
                  className="h-7 w-auto text-sm border-0 bg-transparent p-0 hover-elevate focus:ring-0 text-muted-foreground disabled:opacity-50"
                  data-testid="select-weekday"
                >
                  <SelectValue placeholder={template.dayOfWeek ? getDayName(template.dayOfWeek) : "Laddar..."}>
                    {template.dayOfWeek ? getDayName(template.dayOfWeek) : "Laddar..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Måndag</SelectItem>
                  <SelectItem value="2">Tisdag</SelectItem>
                  <SelectItem value="3">Onsdag</SelectItem>
                  <SelectItem value="4">Torsdag</SelectItem>
                  <SelectItem value="5">Fredag</SelectItem>
                  <SelectItem value="6">Lördag</SelectItem>
                  <SelectItem value="7">Söndag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Time Warning */}
        {exceedsTime && (
          <Card className="p-4 border-destructive bg-destructive/10" data-testid="warning-time-exceeded">
            <div className="flex items-start gap-3">
              <div className="text-destructive font-medium">⚠️ Varning</div>
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  Att lägga till flera set innebär att du överskrider din önskade träningstid.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Beräknad tid: {totalTime} min / Målsatt tid: {sessionDuration} min +10% ({maxAcceptableTime} min)
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Time Summary */}
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Beräknad träningstid</span>
            <span className={`font-semibold ${exceedsTime ? "text-destructive" : "text-foreground"}`} data-testid="text-total-time">
              {totalTime} min
            </span>
          </div>
        </Card>

        {/* Exercises List */}
        <div className="space-y-3">
          {exercises.map((exercise, index) => (
            <Card key={exercise.id} className="p-4 space-y-3" data-testid={`card-exercise-${index}`}>
              {/* Exercise Header with Move Buttons */}
              <div className="flex items-start gap-1">
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveExercise(index, "up")}
                    disabled={index === 0}
                    className="h-6 w-6"
                    data-testid={`button-move-up-${index}`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveExercise(index, "down")}
                    disabled={index === exercises.length - 1}
                    className="h-6 w-6"
                    data-testid={`button-move-down-${index}`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeExercise(index)}
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  data-testid={`button-remove-exercise-${index}`}
                  title="Ta bort övningen"
                >
                  <span className="text-sm font-bold">×</span>
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{exercise.exerciseName}</h3>
                    <ExerciseVideoButton 
                      exerciseName={exercise.exerciseName} 
                      youtubeUrl={exerciseVideos?.[exercise.exerciseName]?.youtubeUrl ?? null}
                      videoType={exerciseVideos?.[exercise.exerciseName]?.videoType ?? null} 
                    />
                  </div>
                  {exercise.muscles && exercise.muscles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {exercise.muscles.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Exercise Parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Set</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={exercise.targetSets || 3}
                    onChange={(e) => updateExercise(index, "targetSets", parseInt(e.target.value) || 1)}
                    className="w-full h-8 px-2 text-center text-foreground bg-card border border-border rounded-md [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-auto"
                    data-testid={`input-sets-${index}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Reps</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={extractMinReps(exercise.targetReps)}
                    onChange={(e) => updateExercise(index, "targetReps", parseInt(e.target.value) || 1)}
                    className="w-full h-8 px-2 text-center text-foreground bg-card border border-border rounded-md [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-auto"
                    data-testid={`input-reps-${index}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Kg</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={exercise.targetWeight ?? ""}
                    onChange={(e) => updateExercise(index, "targetWeight", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="-"
                    className="w-full h-8 px-2 text-center text-foreground bg-card border border-border rounded-md [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-auto"
                    data-testid={`input-weight-${index}`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Add Exercise Button */}
      <div className="p-4 pt-2">
        <Button
          className="w-full h-10 text-base font-semibold"
          variant="outline"
          onClick={() => setShowAddExercise(true)}
          data-testid="button-add-exercise"
        >
          <Plus className="w-5 h-5 mr-2" />
          Lägg till övning
        </Button>
      </div>

      {/* Add Exercise Dialog */}
      <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
        <DialogContent className="max-w-md" data-testid="dialog-add-exercise">
          <DialogHeader>
            <DialogTitle>Lägg till övning</DialogTitle>
            <DialogDescription>
              Välj en övning som passar {template?.muscleFocus || "passet"}
            </DialogDescription>
          </DialogHeader>

          <input
            type="text"
            placeholder="Sök övning..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground"
            data-testid="input-search-exercise"
          />

          <ScrollArea className="h-72 border border-border rounded-md p-2">
            <div className="space-y-1">
              {filteredExercises.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {availableExercises.length === 0 ? "Inga övningar tillgängliga" : "Ingen övning hittad"}
                </div>
              ) : (
                filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => addExerciseMutation.mutate(exercise.name)}
                    disabled={addExerciseMutation.isPending}
                    className="w-full text-left p-2 rounded-md hover:bg-card/80 active:bg-card transition-colors text-sm"
                    data-testid={`button-exercise-${normalizeTestId(exercise.name)}`}
                  >
                    <div className="font-medium text-foreground">{exercise.name}</div>
                    {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {exercise.primaryMuscles.join(", ")}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border p-4 space-y-2">
        {isNextTemplate && (
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={startSession}
            data-testid="button-start-session"
          >
            <Play className="w-5 h-5 mr-2" />
            Starta pass
          </Button>
        )}
        <Button
          className="w-full h-12 text-base font-semibold"
          variant="secondary"
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          data-testid="button-save-changes"
        >
          {saveMutation.isPending ? "Sparar..." : "Spara ändringar"}
        </Button>
      </div>
    </div>
  );
}
