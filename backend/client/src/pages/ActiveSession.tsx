import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Clock, Dumbbell, Target, TrendingUp, Plus, PlayCircle, Trophy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RestTimer from "@/components/RestTimer";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { calculateWeight } from "@shared/weight-calculator";
import { normalizeTestId, formatExerciseWeight } from "@/lib/utils";
import { VideoPlayerDialog } from "@/components/VideoPlayerDialog";
import type { UserProfile, ProgramTemplateExercise, ExerciseLog } from "@shared/schema";

interface SetProgress {
  weight: string;
  reps: string;
}

type WorkoutPhase = "exercise" | "rest";
type RestType = "set" | "exercise";

function parseReps(reps: number | string | null | undefined): string {
  if (reps === null || reps === undefined) return "";
  if (typeof reps === "number") return reps.toString();
  
  const repsStr = reps.toString();
  if (repsStr.includes("-")) {
    const lower = parseInt(repsStr.split("-")[0]);
    return isNaN(lower) ? "" : lower.toString();
  }
  
  const parsed = parseInt(repsStr);
  return isNaN(parsed) ? "" : parsed.toString();
}

function getOneRMForExercise(exerciseName: string, profile: UserProfile | undefined): number | null {
  if (!profile) return null;
  
  // Normalize exercise name: lowercase, remove punctuation, remove parentheses
  // Handles: "Barbell Bench Press (Medium Grip)" → "barbell bench press"
  //          "Lat Pulldown - Wide Grip" → "lat pulldown wide grip"
  //          "Squat, Back" → "squat back"
  const normalizedName = exerciseName
    .toLowerCase()
    .trim()
    .replace(/\([^)]*\)/g, '')  // Remove parentheses and content
    .replace(/[-,;:]/g, ' ')     // Replace punctuation with space
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
  
  // Exact mapping of exercise names to 1RM fields
  // This prevents false matches (e.g., "bench dips" shouldn't match bench press)
  const exerciseMap: Record<string, keyof Pick<UserProfile, 'oneRmBench' | 'oneRmOhp' | 'oneRmDeadlift' | 'oneRmSquat' | 'oneRmLatpull'>> = {
    // Bench press variations (Swedish)
    'bänkpress': 'oneRmBench',
    'bänkpress med skivstång': 'oneRmBench',
    'platt bänkpress': 'oneRmBench',
    'lutande bänkpress': 'oneRmBench',
    'sned bänkpress': 'oneRmBench',
    // Bench press variations (English)
    'bench press': 'oneRmBench',
    'barbell bench press': 'oneRmBench',
    'flat bench press': 'oneRmBench',
    'incline bench press': 'oneRmBench',
    'decline bench press': 'oneRmBench',
    'bb bench press': 'oneRmBench',
    'bench press close grip': 'oneRmBench',
    'bench press wide grip': 'oneRmBench',
    'dumbbell bench press': 'oneRmBench',
    'db bench press': 'oneRmBench',
    'machine bench press': 'oneRmBench',
    'resistance band bench press': 'oneRmBench',
    'chest press': 'oneRmBench',
    'machine chest press': 'oneRmBench',
    
    // Overhead press variations (Swedish)
    'axelpress': 'oneRmOhp',
    'stående axelpress': 'oneRmOhp',
    'axelpress med skivstång': 'oneRmOhp',
    'militärpress': 'oneRmOhp',
    // Overhead press variations (English)
    'overhead press': 'oneRmOhp',
    'shoulder press': 'oneRmOhp',
    'military press': 'oneRmOhp',
    'standing overhead press': 'oneRmOhp',
    'barbell overhead press': 'oneRmOhp',
    'ohp': 'oneRmOhp',
    'dumbbell shoulder press': 'oneRmOhp',
    'db shoulder press': 'oneRmOhp',
    'machine shoulder press': 'oneRmOhp',
    'resistance band shoulder press': 'oneRmOhp',
    'seated shoulder press': 'oneRmOhp',
    'seated overhead press': 'oneRmOhp',
    
    // Deadlift variations (Swedish)
    'marklyft': 'oneRmDeadlift',
    'marklyft med skivstång': 'oneRmDeadlift',
    'konventionell marklyft': 'oneRmDeadlift',
    'rumänsk marklyft': 'oneRmDeadlift',
    'sumo marklyft': 'oneRmDeadlift',
    // Deadlift variations (English)
    'deadlift': 'oneRmDeadlift',
    'barbell deadlift': 'oneRmDeadlift',
    'conventional deadlift': 'oneRmDeadlift',
    'romanian deadlift': 'oneRmDeadlift',
    'sumo deadlift': 'oneRmDeadlift',
    'deficit deadlift': 'oneRmDeadlift',
    
    // Squat variations (Swedish)
    'knäböj': 'oneRmSquat',
    'knäböj med skivstång': 'oneRmSquat',
    'höga knäböj': 'oneRmSquat',
    'låga knäböj': 'oneRmSquat',
    'front knäböj': 'oneRmSquat',
    'främre knäböj': 'oneRmSquat',
    // Squat variations (English)
    'squat': 'oneRmSquat',
    'barbell squat': 'oneRmSquat',
    'back squat': 'oneRmSquat',
    'high bar squat': 'oneRmSquat',
    'low bar squat': 'oneRmSquat',
    'front squat': 'oneRmSquat',
    'pause squat': 'oneRmSquat',
    'goblet squat': 'oneRmSquat',
    'dumbbell squat': 'oneRmSquat',
    'resistance band squat': 'oneRmSquat',
    'machine squat': 'oneRmSquat',
    'hack squat': 'oneRmSquat',
    'leg press': 'oneRmSquat',
    
    // Lat pulldown variations (Swedish)
    'latsdrag': 'oneRmLatpull',
    'latsdrag bred': 'oneRmLatpull',
    'latsdrag smal': 'oneRmLatpull',
    'latsdrag bred grepp': 'oneRmLatpull',
    'latsdrag smalt grepp': 'oneRmLatpull',
    'maskin latsdrag': 'oneRmLatpull',
    'kabel latsdrag': 'oneRmLatpull',
    // Lat pulldown variations (English)
    'lat pulldown': 'oneRmLatpull',
    'wide grip lat pulldown': 'oneRmLatpull',
    'close grip lat pulldown': 'oneRmLatpull',
    'lat pull down': 'oneRmLatpull',
    'lat pulldown wide grip': 'oneRmLatpull',
    'lat pulldown close grip': 'oneRmLatpull',
    'lat pulldown wide': 'oneRmLatpull',
    'lat pulldown narrow': 'oneRmLatpull',
    'cable lat pulldown': 'oneRmLatpull',
    'machine lat pulldown': 'oneRmLatpull',
    'lat pulldown machine': 'oneRmLatpull',
    'resistance band lat pulldown': 'oneRmLatpull',
    'banded lat pulldown': 'oneRmLatpull',
    'assisted pull up': 'oneRmLatpull',
    'pull down': 'oneRmLatpull',
    'cable pull down': 'oneRmLatpull',
  };
  
  // Try exact match first
  let oneRmField = exerciseMap[normalizedName];
  
  // Fallback: check if normalized name starts with a known compound lift
  // This handles cases like "bench press medium grip" → "bench press"
  if (!oneRmField) {
    if (normalizedName.startsWith('bänkpress') || normalizedName.startsWith('bench press') || normalizedName.startsWith('barbell bench')) {
      oneRmField = 'oneRmBench';
    } else if (normalizedName.startsWith('axelpress') || normalizedName.startsWith('overhead press') || normalizedName.startsWith('shoulder press') || normalizedName.startsWith('military press')) {
      oneRmField = 'oneRmOhp';
    } else if (normalizedName.startsWith('marklyft') || normalizedName.startsWith('deadlift') || normalizedName.startsWith('barbell deadlift')) {
      oneRmField = 'oneRmDeadlift';
    } else if (normalizedName.startsWith('knäböj') || (normalizedName.startsWith('squat') && !normalizedName.includes('dip'))) {
      oneRmField = 'oneRmSquat';
    } else if (normalizedName.startsWith('latsdrag') || normalizedName.startsWith('lat pull')) {
      oneRmField = 'oneRmLatpull';
    }
  }
  
  return oneRmField ? (profile[oneRmField] || null) : null;
}

export default function ActiveSession() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Parse search params directly from window.location.search
  // This ensures they're available immediately on render
  const searchParams = new URLSearchParams(window.location.search);
  const urlSessionId = searchParams.get("sessionId");
  const urlTemplateId = searchParams.get("templateId");
  const urlWarmupDone = searchParams.get("warmupDone") === "true";
  
  const [exercises, setExercises] = useState<ProgramTemplateExercise[]>([]);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<WorkoutPhase>("exercise");
  const [restType, setRestType] = useState<RestType>("set");
  const [setProgress, setSetProgress] = useState<SetProgress>({ weight: "", reps: "" });
  const [showAddSetDialog, setShowAddSetDialog] = useState(false);
  const [placeholderLogIds, setPlaceholderLogIds] = useState<Record<string, string>>({});
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);
  const [showSmartRepDialog, setShowSmartRepDialog] = useState(false);
  const [pendingSetData, setPendingSetData] = useState<{ weight: number; reps: number } | null>(null);
  const [originalValues, setOriginalValues] = useState<{ weight: string; reps: string }>({ weight: "", reps: "" });
  const [plannedValues, setPlannedValues] = useState<{ weight: string; reps: string }>({ weight: "", reps: "" });
  const [bulkState, setBulkState] = useState<{ weight: string; reps: string; exerciseIdx: number } | null>(null);
  const [skippedExercises, setSkippedExercises] = useState<number[]>([]);
  const [optimisticallyCompleted, setOptimisticallyCompleted] = useState<Set<number>>(new Set());
  const [isTransitioningToRest, setIsTransitioningToRest] = useState(false);

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: template } = useQuery<any>({
    queryKey: [`/api/program/${urlTemplateId}`],
    enabled: !!urlTemplateId,
  });

  const { data: session } = useQuery<any>({
    queryKey: [`/api/sessions/${urlSessionId}`],
    enabled: !!urlSessionId,
  });

  const { data: sessionLogs } = useQuery<any[]>({
    queryKey: [`/api/sessions/${urlSessionId}/exercises`],
    enabled: !!urlSessionId,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      return apiRequest("POST", "/api/sessions", sessionData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      
      // Använd setLocation för att trigga location update (inte replaceState)
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set("sessionId", data.id);
      setLocation(`${window.location.pathname}?${currentParams.toString()}`);
    },
  });

  const createExerciseLogMutation = useMutation({
    mutationFn: async (exerciseData: any) => {
      return apiRequest("POST", "/api/exercises", exerciseData);
    },
    onSuccess: () => {
      // Invalidera sessionLogs för att uppdatera progress
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${urlSessionId}/exercises`] });
    },
  });

  const updateExerciseLogMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/exercises/${id}`, data);
    },
    onSuccess: () => {
      // Invalidera sessionLogs för att uppdatera progress
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${urlSessionId}/exercises`] });
    },
  });

  const bulkUpdateExerciseLogsMutation = useMutation({
    mutationFn: async ({ sessionId, exerciseOrderIndex, data }: { sessionId: string; exerciseOrderIndex: number; data: { weight?: number; reps?: number } }) => {
      return apiRequest("POST", `/api/sessions/${sessionId}/exercises/${exerciseOrderIndex}/bulk-update`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${variables.sessionId}/exercises`] });
    },
  });

  // Reset optimistic completion when session changes
  // This prevents stale completion data from previous sessions/tests
  // Note: Page refresh automatically resets state via component unmount/remount
  useEffect(() => {
    setOptimisticallyCompleted(new Set());
  }, [urlSessionId]);

  // Load skipped exercises from session snapshot on resume
  useEffect(() => {
    if (session?.snapshotData?.skippedExercises) {
      // Validate: must be array of finite numbers
      const skipped = session.snapshotData.skippedExercises;
      if (Array.isArray(skipped) && skipped.every(idx => Number.isFinite(idx))) {
        // Bounds check: only include indices within exercise list
        const validSkipped = skipped.filter(idx => idx >= 0 && idx < exercises.length);
        
        // Reconcile: remove exercises that are already complete
        const reconciledSkipped = validSkipped.filter(idx => !isExerciseComplete(idx));
        
        // Only persist if we removed some (avoid unnecessary PATCH)
        if (reconciledSkipped.length < validSkipped.length && urlSessionId) {
          persistSkipQueue(reconciledSkipped);
        }
        
        setSkippedExercises(reconciledSkipped);
      }
    }
  }, [session, exercises.length, sessionLogs]);

  useEffect(() => {
    // Skip validation if resuming an existing session
    if (urlSessionId) {
      return;
    }

    if (!urlTemplateId) {
      toast({
        title: "Ingen template vald",
        description: "Kunde inte hitta träningspass",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }

    if (!urlWarmupDone) {
      setLocation(`/warmup?templateId=${urlTemplateId}`);
      return;
    }
  }, [urlSessionId, urlTemplateId, urlWarmupDone]);

  useEffect(() => {
    // Priority 1: If resuming without template, build from sessionLogs  
    if (!urlTemplateId && sessionLogs && sessionLogs.length > 0 && urlSessionId) {
      const exerciseMap = new Map<string, any>();
      
      sessionLogs.forEach((log: any) => {
        if (!exerciseMap.has(log.exerciseTitle)) {
          exerciseMap.set(log.exerciseTitle, {
            exerciseName: log.exerciseTitle,
            exerciseKey: log.exerciseKey,
            targetSets: log.setNumber,
            targetReps: log.reps || "",
            targetWeight: log.weight || null,
            orderIndex: exerciseMap.size,
            requiredEquipment: [],
            muscles: [],
            notes: null,
          });
        } else {
          const existing = exerciseMap.get(log.exerciseTitle);
          existing.targetSets = Math.max(existing.targetSets, log.setNumber);
        }
      });
      
      const rebuiltExercises = Array.from(exerciseMap.values());
      setExercises(rebuiltExercises);
      
      // Restore progress from completed logs
      const completedLogs = sessionLogs.filter((log: any) => log.completed);
      if (completedLogs.length > 0) {
        const sortedLogs = [...completedLogs].sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const lastLog = sortedLogs[0];
        const exerciseIdx = rebuiltExercises.findIndex(
          (ex: ProgramTemplateExercise) => ex.exerciseName === lastLog.exerciseTitle
        );
        
        if (exerciseIdx >= 0) {
          const exercise = rebuiltExercises[exerciseIdx];
          if (lastLog.setNumber >= exercise.targetSets) {
            setCurrentExerciseIdx(Math.min(exerciseIdx + 1, rebuiltExercises.length - 1));
            setCurrentSetIdx(0);
          } else {
            setCurrentExerciseIdx(exerciseIdx);
            setCurrentSetIdx(lastLog.setNumber);
          }
        }
      }
      return; // Exit early, don't continue to template logic
    }
    
    if (template?.exercises && sessionLogs && urlSessionId && currentPhase !== "rest" && !isTransitioningToRest) {
      // Återställ exercises baserat på exercise logs från databasen
      // SKIP this during rest phase OR when pending rest transition to prevent race condition
      // where currentExerciseIdx is updated before rest phase begins
      const exercisesWithAdjustedSets = template.exercises.map((exercise: ProgramTemplateExercise, idx: number) => {
        // Hitta alla logs för denna övning
        const logsForExercise = sessionLogs.filter(
          (log: any) => log.exerciseTitle === exercise.exerciseName
        );
        
        if (logsForExercise.length > 0) {
          // Räkna max setNumber som faktiskt targetSets
          const maxSetNumber = Math.max(...logsForExercise.map((log: any) => log.setNumber));
          return {
            ...exercise,
            targetSets: Math.max(exercise.targetSets, maxSetNumber),
          };
        }
        
        return exercise;
      });
      
      setExercises(exercisesWithAdjustedSets);
      
      // Återställ placeholderLogIds för incomplete logs
      const placeholders: Record<string, string> = {};
      sessionLogs.forEach((log: any) => {
        if (!log.completed) {
          const exerciseIdx = exercisesWithAdjustedSets.findIndex(
            (ex: ProgramTemplateExercise) => ex.exerciseName === log.exerciseTitle
          );
          if (exerciseIdx >= 0) {
            const key = `${exerciseIdx}-${log.setNumber}`;
            placeholders[key] = log.id;
          }
        }
      });
      setPlaceholderLogIds(placeholders);
      
      // Återställ progress (currentExerciseIdx och currentSetIdx) baserat på TEMPLATE-ORDNING
      // Hitta första övning med incomplete sets istället för sista completed log
      let foundIncomplete = false;
      for (let exerciseIdx = 0; exerciseIdx < exercisesWithAdjustedSets.length; exerciseIdx++) {
        const exercise = exercisesWithAdjustedSets[exerciseIdx];
        
        // Hitta ALLA logs (både completed och incomplete) för denna övning
        const allLogsForExercise = sessionLogs.filter(
          (log: any) => log.exerciseTitle === exercise.exerciseName
        );
        
        // Räkna endast completed logs för att hitta nästa set
        const completedLogsForExercise = allLogsForExercise.filter((log: any) => log.completed);
        
        // Om inte alla sets är completed, sätt currentExerciseIdx här
        if (completedLogsForExercise.length < exercise.targetSets) {
          setCurrentExerciseIdx(exerciseIdx);
          // currentSetIdx = antal completed sets (0-indexed, så nästa incomplete set)
          setCurrentSetIdx(completedLogsForExercise.length);
          foundIncomplete = true;
          break;
        }
      }
      
      // Om alla övningar är kompletta, sätt till sista övningen
      if (!foundIncomplete && exercisesWithAdjustedSets.length > 0) {
        setCurrentExerciseIdx(exercisesWithAdjustedSets.length - 1);
        setCurrentSetIdx(exercisesWithAdjustedSets[exercisesWithAdjustedSets.length - 1].targetSets);
      }
    } else if (!template && sessionLogs && sessionLogs.length > 0 && urlSessionId) {
      // Resume session without template: build exercises from sessionLogs
      // Räkna antal sets per övning (både completed och incomplete logs)
      const exerciseMap = new Map<string, any>();
      const setCountMap = new Map<string, number>();
      
      sessionLogs.forEach((log: any) => {
        const count = setCountMap.get(log.exerciseTitle) || 0;
        setCountMap.set(log.exerciseTitle, count + 1);
        
        if (!exerciseMap.has(log.exerciseTitle)) {
          exerciseMap.set(log.exerciseTitle, {
            exerciseName: log.exerciseTitle,
            exerciseKey: log.exerciseKey,
            targetSets: 1, // Will be updated below
            targetReps: log.reps || "",
            targetWeight: log.weight || null,
            orderIndex: exerciseMap.size,
            requiredEquipment: [],
            muscles: [],
            notes: null,
          });
        }
      });
      
      // Uppdatera targetSets med faktiskt antal logs per övning
      exerciseMap.forEach((exercise, title) => {
        exercise.targetSets = setCountMap.get(title) || 1;
      });
      
      const rebuiltExercises = Array.from(exerciseMap.values());
      setExercises(rebuiltExercises);
      
      // Återställ placeholderLogIds för incomplete logs
      const placeholders: Record<string, string> = {};
      sessionLogs.forEach((log: any) => {
        if (!log.completed) {
          const exerciseIdx = rebuiltExercises.findIndex(
            (ex: ProgramTemplateExercise) => ex.exerciseName === log.exerciseTitle
          );
          if (exerciseIdx >= 0) {
            const key = `${exerciseIdx}-${log.setNumber}`;
            placeholders[key] = log.id;
          }
        }
      });
      setPlaceholderLogIds(placeholders);
      
      // Återställ progress från completed logs
      const completedLogs = sessionLogs.filter((log: any) => log.completed);
      if (completedLogs.length > 0) {
        const sortedLogs = [...completedLogs].sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const lastLog = sortedLogs[0];
        
        const exerciseIdx = rebuiltExercises.findIndex(
          (ex: ProgramTemplateExercise) => ex.exerciseName === lastLog.exerciseTitle
        );
        
        if (exerciseIdx >= 0) {
          const exercise = rebuiltExercises[exerciseIdx];
          if (lastLog.setNumber >= exercise.targetSets) {
            setCurrentExerciseIdx(Math.min(exerciseIdx + 1, rebuiltExercises.length - 1));
            setCurrentSetIdx(0);
          } else {
            setCurrentExerciseIdx(exerciseIdx);
            setCurrentSetIdx(lastLog.setNumber);
          }
        }
      }
    } else if (template?.exercises && !sessionLogs) {
      setExercises(template.exercises);
      
      if (!urlSessionId) {
        createSessionMutation.mutate({
          templateId: urlTemplateId,
          sessionName: template.templateName || "Träningspass",
          sessionType: "strength",
          startedAt: new Date().toISOString(),
        });
      }
    }
  }, [template, sessionLogs, urlSessionId]);

  // Effekt för att sätta initial values när övning ändras
  // Använd en ref för att tracka tidigare exerciseIdx och undvika reset vid exercise rebuild
  const prevExerciseIdxRef = useRef<number>(-1);
  
  useEffect(() => {
    const currentExercise = exercises[currentExerciseIdx];
    
    // Returnera tidigt om exercise inte finns än (data fortfarande laddar)
    if (!currentExercise) {
      return;
    }
    
    const exerciseChanged = prevExerciseIdxRef.current !== currentExerciseIdx;
    
    // Uppdatera ref BARA efter vi vet att exercise finns
    prevExerciseIdxRef.current = currentExerciseIdx;
    
    if (exerciseChanged) {
      // Återställ bara till template-värden när övning FAKTISKT ändras
      const weight = currentExercise.targetWeight !== null && currentExercise.targetWeight !== undefined 
        ? currentExercise.targetWeight.toString() 
        : "";
      const reps = parseReps(currentExercise.targetReps);
      setSetProgress({ weight, reps });
      setOriginalValues({ weight, reps }); // Bara första gången för övningen
      setPlannedValues({ weight, reps }); // Planned values från template
      // Rensa bulk state när övning ändras
      setBulkState(null);
    }
  }, [currentExerciseIdx, exercises]);


  // Helper: Check if an exercise has all sets completed
  const isExerciseComplete = (exerciseIdx: number): boolean => {
    // Check optimistic completion first (for just-completed exercises)
    if (optimisticallyCompleted.has(exerciseIdx)) return true;
    
    if (!sessionLogs || !exercises[exerciseIdx]) return false;
    
    const exercise = exercises[exerciseIdx];
    
    // Defensive: exercises with targetSets=0 should never be considered complete
    // (they may be data errors or not properly initialized)
    if (!exercise.targetSets || exercise.targetSets <= 0) {
      return false;
    }
    
    // Match by exerciseOrderIndex (position in template) instead of exerciseTitle
    // This prevents logs from other exercises with same name from being counted
    const completedLogsForExercise = sessionLogs.filter(
      (log: any) => log.exerciseOrderIndex === exerciseIdx && log.completed === true
    );
    
    const isComplete = completedLogsForExercise.length >= exercise.targetSets;
    
    return isComplete;
  };


  const completeSingleSet = async (weight: number, reps: number): Promise<boolean> => {
    if (!urlSessionId) {
      throw new Error("Session saknas");
    }

    // Förhindra dubbla klick genom att kolla mutation status - returnera tyst
    if (createExerciseLogMutation.isPending || updateExerciseLogMutation.isPending) {
      return false;
    }

    const currentExercise = exercises[currentExerciseIdx];
    const setNumber = currentSetIdx + 1;
    const placeholderKey = `${currentExerciseIdx}-${setNumber}`;
    const placeholderLogId = placeholderLogIds[placeholderKey];

    if (placeholderLogId) {
      // Uppdatera befintligt placeholder log
      await updateExerciseLogMutation.mutateAsync({
        id: placeholderLogId,
        data: {
          reps,
          weight,
          completed: true,
        },
      });
      
      // Ta bort placeholder ID från state
      setPlaceholderLogIds(prev => {
        const updated = { ...prev };
        delete updated[placeholderKey];
        return updated;
      });
    } else {
      // Skapa nytt log som vanligt
      await createExerciseLogMutation.mutateAsync({
        workoutSessionId: urlSessionId,
        exerciseKey: `${currentExercise.exerciseName.toLowerCase().replace(/\s+/g, '-')}-${currentSetIdx}`,
        exerciseTitle: currentExercise.exerciseName,
        exerciseOrderIndex: currentExerciseIdx, // Track exercise position in template
        setNumber,
        reps,
        weight,
        completed: true,
      });
    }

    // Uppdatera originalValues till just loggade värden för nästa set
    setOriginalValues({ weight: weight.toString(), reps: reps.toString() });

    const isLastSet = currentSetIdx >= (currentExercise.targetSets - 1);

    if (isLastSet) {
      // Set transition flag to prevent useEffect from updating currentExerciseIdx
      // before rest phase begins (prevents exercise skipping bug)
      setIsTransitioningToRest(true);
      
      // Sista setet i övning - mark as complete
      setOptimisticallyCompleted(prev => new Set(prev).add(currentExerciseIdx));
      
      // Ta bort övningen från skip queue om den finns där (den är nu färdig!)
      if (skippedExercises.includes(currentExerciseIdx)) {
        const cleanedQueue = skippedExercises.filter(idx => idx !== currentExerciseIdx);
        const previousQueue = [...skippedExercises]; // Copy for rollback
        setSkippedExercises(cleanedQueue);
        // Persist cleaned queue to backend with error handling
        persistSkipQueue(cleanedQueue).catch(() => {
          // Rollback on failure to keep frontend/backend in sync
          setSkippedExercises(previousQueue);
        });
      }
      
      // CRITICAL: Fetch fresh session logs from backend after mutation
      // This ensures we have up-to-date completion data before navigation
      try {
        const freshLogs = await queryClient.fetchQuery<ExerciseLog[]>({
          queryKey: [`/api/sessions/${urlSessionId}/exercises`]
        });
        
        // Check if all exercises in template are complete using fresh logs
        let allExercisesComplete = true;
        for (let i = 0; i < exercises.length; i++) {
          const exercise = exercises[i];
          const completedSetsForExercise = freshLogs.filter(
            log => log.exerciseOrderIndex === i && log.completed === true
          ).length;
          
          if (completedSetsForExercise < exercise.targetSets) {
            allExercisesComplete = false;
            break;
          }
        }
        
        // If workout is complete, ALWAYS navigate to celebration
        if (allExercisesComplete) {
          setLocation(`/session/complete?id=${urlSessionId}`);
          return true; // Signal navigation occurred
        }
      } catch (fetchError) {
        // Continue to rest phase even if fetch fails (fail gracefully)
      }
      
      // More exercises remain - go to rest phase before next exercise
      setRestType("exercise");
      setCurrentPhase("rest");
      // Clear transition flag now that rest phase has begun
      setTimeout(() => {
        setIsTransitioningToRest(false);
      }, 50);
    } else{
      // Vanligt set - 90 sek paus mellan sets
      setCurrentSetIdx(currentSetIdx + 1);
      setRestType("set");
      setCurrentPhase("rest");
    }
    
    return false; // No navigation occurred
  };

  const handleCompleteSet = async () => {
    if (!urlSessionId) {
      toast({
        title: "Session saknas",
        description: "Kunde inte hitta träningssessionen",
        variant: "destructive",
      });
      return;
    }

    const currentExercise = exercises[currentExerciseIdx];
    const weight = parseFloat(setProgress.weight) || 0;
    const reps = parseInt(setProgress.reps) || 0;

    // Check if this is a time-based exercise
    const repsValue = currentExercise.targetReps || "8-12";
    const isTimeBased = typeof repsValue === 'string' && 
      (repsValue.toLowerCase().includes('sec') || repsValue.toLowerCase().includes('sekund'));

    // Validation: skip for time-based exercises (they can have 0 reps as they measure time)
    if (!isTimeBased && reps === 0) {
      toast({
        title: "Fyll i reps",
        description: "Du måste fylla i antal repetitioner",
        variant: "destructive",
      });
      return;
    }

    // Check if this is the final set of the final exercise
    const isLastSet = currentSetIdx >= (currentExercise.targetSets - 1);
    const nextExercise = isLastSet ? findNextIncompleteExercise(currentExerciseIdx) : null;
    const isFinalSetOfFinalExercise = isLastSet && !nextExercise;

    // Kolla om värden har ändrats jämfört med föregående set
    const originalWeight = parseFloat(originalValues.weight) || 0;
    const originalReps = parseInt(originalValues.reps) || 0;
    const weightChanged = weight !== originalWeight;
    const repsChanged = reps !== originalReps;
    
    // Om inga ändringar, bara spara setet
    if (!weightChanged && !repsChanged) {
      try {
        await completeSingleSet(weight, reps);
      } catch (error: any) {
        toast({
          title: "Fel vid sparning",
          description: error?.message || "Kunde inte spara set. Försök igen.",
          variant: "destructive",
        });
      }
      return;
    }
    if (isLastSet) {
      try {
        await completeSingleSet(weight, reps);
      } catch (error: any) {
        toast({
          title: "Fel vid sparning",
          description: error?.message || "Kunde inte spara set. Försök igen.",
          variant: "destructive",
        });
      }
      return;
    }

    // Skip bulk update/smart rep dialogs for time-based exercises
    if (isTimeBased) {
      try {
        await completeSingleSet(weight, reps);
      } catch (error: any) {
        toast({
          title: "Fel vid sparning",
          description: error?.message || "Kunde inte spara set. Försök igen.",
          variant: "destructive",
        });
      }
      return;
    }

    // Spara pending data och visa rätt dialog
    setPendingSetData({ weight, reps });

    // Kolla om reps ökade med mer än 3 jämfört med PLANNED values
    const plannedReps = parseInt(plannedValues.reps) || 0;
    const repIncrease = reps - plannedReps;
    if (repIncrease > 3) {
      setShowSmartRepDialog(true);
    } else {
      setShowBulkUpdateDialog(true);
    }
  };

  const handleBulkUpdate = async (applyToAll: boolean, keepOriginalReps: boolean = false) => {
    if (!pendingSetData || !urlSessionId) return;

    const { weight, reps } = pendingSetData;
    const currentExercise = exercises[currentExerciseIdx];

    // Check if this is the final set of the final exercise
    const isLastSet = currentSetIdx >= (currentExercise.targetSets - 1);
    const nextExercise = isLastSet ? findNextIncompleteExercise(currentExerciseIdx) : null;
    const isFinalSetOfFinalExercise = isLastSet && !nextExercise;

    // Spara nuvarande set först - avbryt vid error
    let didNavigate = false;
    try {
      didNavigate = await completeSingleSet(weight, reps);
    } catch (error: any) {
      toast({
        title: "Fel vid sparning av set",
        description: error?.message || "Kunde inte spara nuvarande set. Försök igen.",
        variant: "destructive",
      });
      return; // Avbryt bulk update om set completion failar
    }
    
    // If navigation occurred (workout complete), stop here - don't do bulk update
    if (didNavigate) {
      return;
    }

    // Om användaren valde att uppdatera alla sets
    if (applyToAll) {
      try {
        // Use exerciseOrderIndex for bulk update (position in template)
        const exerciseOrderIndex = currentExerciseIdx;
        
        // Om smart dialog och användaren vill behålla planerade reps, använd plannedValues
        // Annars skicka både weight och reps som användes
        const updateData = keepOriginalReps 
          ? { weight, reps: parseInt(plannedValues.reps) || reps }
          : { weight, reps };
        
        await bulkUpdateExerciseLogsMutation.mutateAsync({
          sessionId: urlSessionId,
          exerciseOrderIndex,
          data: updateData,
        });

        // Vid framgång, uppdatera både originalValues OCH setProgress för nästa set
        const updatedReps = keepOriginalReps ? (parseInt(plannedValues.reps) || reps) : reps;
        setOriginalValues({ weight: weight.toString(), reps: updatedReps.toString() });
        
        // Uppdatera även setProgress så nästa set visar rätt värden direkt
        setSetProgress({ weight: weight.toString(), reps: updatedReps.toString() });
        
        // Spara bulk state för att propagera till ALLA återstående sets i denna övning
        setBulkState({ 
          weight: weight.toString(), 
          reps: updatedReps.toString(),
          exerciseIdx: currentExerciseIdx 
        });

        // Rensa pending data och stäng dialog
        setPendingSetData(null);
        setShowBulkUpdateDialog(false);
        setShowSmartRepDialog(false);

        toast({
          title: "Alla set uppdaterade",
          description: keepOriginalReps 
            ? `Vikten uppdaterades för alla återstående set`
            : `Vikt och reps uppdaterades för alla återstående set`,
        });
      } catch (error: any) {
        
        // Vid fel, behåll dialog open och visa error
        toast({
          title: "Fel vid bulk-uppdatering",
          description: error?.message || "Kunde inte uppdatera alla sets. Försök igen.",
          variant: "destructive",
        });
        return; // Avbryt utan att stänga dialog
      }
    } else {
      // Användaren valde att inte uppdatera alla sets
      // Rensa bulk state (ingen propagation)
      setBulkState(null);
      setPendingSetData(null);
      setShowBulkUpdateDialog(false);
      setShowSmartRepDialog(false);
    }
  };

  const handleRestComplete = () => {
    if (restType === "exercise") {
      // Find next incomplete exercise (Solution C with completion-awareness)
      const nextExercise = findNextIncompleteExercise(currentExerciseIdx);
      
      if (nextExercise) {
        setCurrentExerciseIdx(nextExercise.exerciseIdx);
        setCurrentSetIdx(0);
        setSetProgress({ weight: "", reps: "" });
        setBulkState(null);
      } else {
        // All exercises complete!
        setCurrentPhase("exercise");
        toast({
          title: "Alla övningar klara!",
          description: "Klicka på 'Slutför pass' för att avsluta träningen",
        });
        return;
      }
    } else if (bulkState && bulkState.exerciseIdx === currentExerciseIdx) {
      // Bulk update aktiv: återställ setProgress till bulk-värden för ALLA återstående sets
      setSetProgress({ weight: bulkState.weight, reps: bulkState.reps });
    }
    setCurrentPhase("exercise");
  };

  // Helper: Find next incomplete exercise
  // Returns: { exerciseIdx, source: 'template' | 'skipped' } | null
  const findNextIncompleteExercise = (fromIndex: number): { exerciseIdx: number; source: 'template' | 'skipped' } | null => {
    // First, check forward in template order
    for (let i = fromIndex + 1; i < exercises.length; i++) {
      if (!isExerciseComplete(i)) {
        return { exerciseIdx: i, source: 'template' };
      }
    }
    
    // Then, check skipped exercises
    for (const skippedIdx of skippedExercises) {
      if (!isExerciseComplete(skippedIdx)) {
        return { exerciseIdx: skippedIdx, source: 'skipped' };
      }
    }
    
    // No incomplete exercises found
    return null;
  };

  // Shared function to persist skip queue to backend
  const persistSkipQueue = async (skippedList: number[]) => {
    if (!urlSessionId) return false;
    
    try {
      await apiRequest("PATCH", `/api/sessions/${urlSessionId}/snapshot`, {
        skippedExercises: skippedList,
      });
      return true;
    } catch (error) {
      toast({
        title: "Kunde inte spara",
        description: "Hoppade övningar kunde inte sparas. Försök igen.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleSkipRest = async () => {
    if (restType === "exercise") {
      // Find next incomplete exercise (Solution C with completion-awareness)
      const nextExercise = findNextIncompleteExercise(currentExerciseIdx);
      
      if (nextExercise) {
        setCurrentExerciseIdx(nextExercise.exerciseIdx);
        setCurrentSetIdx(0);
        setSetProgress({ weight: "", reps: "" });
        setBulkState(null);
      } else {
        // All exercises complete!
        setCurrentPhase("exercise");
        toast({
          title: "Alla övningar klara!",
          description: "Klicka på 'Slutför pass' för att avsluta träningen",
        });
        return;
      }
    } else if (bulkState && bulkState.exerciseIdx === currentExerciseIdx) {
      // Bulk update aktiv: återställ setProgress till bulk-värden för ALLA återstående sets
      setSetProgress({ weight: bulkState.weight, reps: bulkState.reps });
    }
    setCurrentPhase("exercise");
  };

  const handleSkipExercise = async () => {
    if (!urlSessionId) return;

    // Add current exercise to skipped queue
    const newSkippedList = skippedExercises.includes(currentExerciseIdx)
      ? [...skippedExercises] // Copy to avoid mutation issues
      : [...skippedExercises, currentExerciseIdx];

    setSkippedExercises(newSkippedList);

    // Persist skipped exercises to backend
    const success = await persistSkipQueue(newSkippedList);
    if (!success) {
      // Rollback local state on failure
      setSkippedExercises([...skippedExercises]); // Copy to avoid reference issues
      return;
    }

    // Find next incomplete exercise (Solution C with completion-awareness)
    const nextExercise = findNextIncompleteExercise(currentExerciseIdx);
    
    if (nextExercise) {
      setCurrentExerciseIdx(nextExercise.exerciseIdx);
      setCurrentSetIdx(0);
      setSetProgress({ weight: "", reps: "" });
      setBulkState(null);
      setCurrentPhase("exercise");

      toast({
        title: "Övning överhoppad",
        description: `Du återkommer till ${exercises[currentExerciseIdx]?.exerciseName} senare`,
      });
    } else {
      // All exercises complete or skipped!
      setCurrentPhase("exercise");
      toast({
        title: "Alla övningar klara!",
        description: "Klicka på 'Slutför pass' för att avsluta träningen",
      });
    }
  };

  const handleFinishSession = () => {
    if (!urlSessionId) return;
    setLocation(`/session/complete?id=${urlSessionId}`);
  };

  const handleAddExtraSet = async () => {
    if (!urlSessionId) {
      toast({
        title: "Session saknas",
        description: "Kunde inte hitta träningssessionen",
        variant: "destructive",
      });
      return;
    }

    const currentExercise = exercises[currentExerciseIdx];
    const oldTargetSets = currentExercise.targetSets;
    const newSetNumber = oldTargetSets + 1;
    
    try {
      // Skapa placeholder log för det extra settet
      const response = await createExerciseLogMutation.mutateAsync({
        workoutSessionId: urlSessionId,
        exerciseKey: `${currentExercise.exerciseName.toLowerCase().replace(/\s+/g, '-')}-${newSetNumber}`,
        exerciseTitle: currentExercise.exerciseName,
        exerciseOrderIndex: currentExerciseIdx, // Track exercise position in template
        setNumber: newSetNumber,
        reps: 0,
        weight: 0,
        completed: false,
      });

      const logData = await response.json();
      
      // Spara placeholder log ID för senare uppdatering
      const placeholderKey = `${currentExerciseIdx}-${newSetNumber}`;
      setPlaceholderLogIds(prev => ({
        ...prev,
        [placeholderKey]: logData.id,
      }));

      // Öka antalet sets för denna övning lokalt
      const updatedExercises = [...exercises];
      updatedExercises[currentExerciseIdx] = {
        ...currentExercise,
        targetSets: newSetNumber,
      };
      setExercises(updatedExercises);

      // CRITICAL: If currentSetIdx is at or past the original targetSets, move to next incomplete set
      // This prevents "Set 4/3" bug where currentSetIdx exceeds targetSets
      if (currentSetIdx >= oldTargetSets - 1) {
        setCurrentSetIdx(oldTargetSets); // Point to the newly available set (0-indexed)
      }

      toast({
        title: "Extra set tillagt",
        description: `Du har nu ${newSetNumber} sets för ${currentExercise.exerciseName}`,
      });

      setShowAddSetDialog(false);
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte lägga till extra set. Försök igen.",
        variant: "destructive",
      });
    }
  };

  const currentExercise = exercises[currentExerciseIdx];
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  
  const { data: exerciseVideo } = useQuery<{ youtubeUrl: string | null; videoType: string | null }>({
    queryKey: ["/api/exercises/video", currentExercise?.exerciseName],
    queryFn: async ({ queryKey }) => {
      const [, exerciseName] = queryKey;
      if (!exerciseName) return { youtubeUrl: null, videoType: null };
      const response = await apiRequest("GET", `/api/exercises/video?name=${encodeURIComponent(exerciseName as string)}`);
      if (!response.ok) {
        return { youtubeUrl: null, videoType: null };
      }
      return await response.json();
    },
    enabled: !!currentExercise?.exerciseName,
  });
  
  if (!currentExercise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Förbereder session...</p>
        </div>
      </div>
    );
  }

  // Beräkna elapsed time från session.startedAt
  const sessionStartTime = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const elapsedMinutes = Math.floor((Date.now() - sessionStartTime) / 1000 / 60);

  // Räkna completedSets från faktiska completed logs
  const completedLogsCount = sessionLogs?.filter((log: any) => log.completed).length || 0;
  const totalSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const completedSets = completedLogsCount;
  const progressPercentage = (completedSets / totalSets) * 100;

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span data-testid="text-elapsed-time">{elapsedMinutes} min</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <Progress value={progressPercentage} className="h-2" data-testid="progress-session" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Set {Math.min(completedSets + 1, totalSets)} av {totalSets} totalt
          </p>
        </div>
      </div>

      {currentPhase === "rest" ? (
        <div className="px-4 pt-6">
          {completedSets >= totalSets ? (
            // All sets complete - show finish button without celebration
            <div className="text-center">
              <Button
                size="lg"
                className="w-full"
                onClick={handleFinishSession}
                data-testid="button-finish-session"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Slutför träningspass
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Bra jobbat!</h2>
                <p className="text-muted-foreground mt-1">
                  {restType === "exercise" ? "Vila innan nästa övning" : "Vila innan nästa set"}
                </p>
              </div>
              <RestTimer 
                restTime={restType === "exercise" ? 120 : (profile?.restTime || 90)} 
                onComplete={handleRestComplete}
                onSkip={handleSkipRest}
              />
            </>
          )}
        </div>
      ) : (
        <div className="px-4 pt-6">
          <Card className="mb-6" data-testid="card-current-exercise">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-2xl">{currentExercise.exerciseName}</CardTitle>
                    {exerciseVideo?.youtubeUrl && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => setVideoDialogOpen(true)}
                        data-testid={`button-video-${normalizeTestId(currentExercise.exerciseName)}`}
                      >
                        <PlayCircle className="w-5 h-5 text-primary" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Dumbbell className="w-4 h-4" />
                    <span>
                      Övning {currentExerciseIdx + 1} av {exercises.length}
                    </span>
                  </div>
                  {skippedExercises.includes(currentExerciseIdx) && (
                    <Badge variant="secondary" className="mt-2">
                      Återkommen från skip
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0">
                  Set {currentSetIdx + 1}/{currentExercise.targetSets}
                </Badge>
              </div>
              {/* Skip exercise button */}
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkipExercise}
                  disabled={currentExerciseIdx + 1 >= exercises.length && skippedExercises.length === 0}
                  className="w-full"
                  data-testid="button-skip-exercise"
                >
                  <ChevronLeft className="w-4 h-4 mr-2 rotate-180" />
                  Hoppa till nästa övning
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Mål
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const repsValue = currentExercise.targetReps || "8-12";
                const isTimeBased = typeof repsValue === 'string' && 
                  (repsValue.toLowerCase().includes('sec') || repsValue.toLowerCase().includes('sekund'));
                
                return (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isTimeBased ? "Tid:" : "Repetitioner:"}
                    </span>
                    <span className="font-medium">{repsValue}</span>
                  </div>
                );
              })()}
              
              {(() => {
                // Don't show weight suggestions for time-based exercises
                const repsValue = currentExercise.targetReps || "8-12";
                const isTimeBased = typeof repsValue === 'string' && 
                  (repsValue.toLowerCase().includes('sec') || repsValue.toLowerCase().includes('sekund'));
                
                if (isTimeBased) {
                  return null; // No weight suggestions for time-based exercises
                }
                
                const oneRM = getOneRMForExercise(currentExercise.exerciseName, profile);
                const targetRepsNum = typeof currentExercise.targetReps === 'string' 
                  ? parseInt(parseReps(currentExercise.targetReps))
                  : (currentExercise.targetReps || 8);
                
                if (oneRM && oneRM > 0 && targetRepsNum > 0) {
                  // Calculate weight suggestions based on 1RM
                  const suggestedWeight = calculateWeight(oneRM, targetRepsNum, 2);
                  
                  return (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-medium">Baserat på ditt 1RM ({oneRM}kg)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rekommenderad vikt:</span>
                        <span className="font-bold text-primary" data-testid="text-1rm-suggestion">
                          {suggestedWeight} kg
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        Med ~2 reps kvar i reserv
                      </p>
                    </div>
                  );
                }
                
                // Fallback to AI suggestion if no 1RM
                if (currentExercise.targetWeight) {
                  return (
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground">AI-förslag:</span>
                      <span className="font-medium">{formatExerciseWeight(currentExercise.targetWeight, currentExercise.exerciseName)}</span>
                    </div>
                  );
                }
                
                return null;
              })()}
            </CardContent>
          </Card>

          <Card className="mb-6" data-testid="card-set-input">
            <CardHeader>
              <CardTitle className="text-lg">Logga set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Vikt (kg)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={setProgress.weight}
                  onChange={(e) => setSetProgress({ ...setProgress, weight: e.target.value })}
                  data-testid="input-weight"
                  className="text-lg"
                />
              </div>
              <div>
                {(() => {
                  const repsValue = currentExercise.targetReps || "8-12";
                  const isTimeBased = typeof repsValue === 'string' && 
                    (repsValue.toLowerCase().includes('sec') || repsValue.toLowerCase().includes('sekund'));
                  
                  return (
                    <>
                      <label className="text-sm font-medium mb-2 block">
                        {isTimeBased ? "Tid (sekunder)" : "Repetitioner"}
                      </label>
                      <Input
                        type="number"
                        placeholder={currentExercise.targetReps || "0"}
                        value={setProgress.reps}
                        onChange={(e) => setSetProgress({ ...setProgress, reps: e.target.value })}
                        data-testid="input-reps"
                        className="text-lg"
                      />
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="lg"
              onClick={handleCompleteSet}
              disabled={createExerciseLogMutation.isPending || updateExerciseLogMutation.isPending || !urlSessionId}
              data-testid="button-complete-set"
            >
              {(createExerciseLogMutation.isPending || updateExerciseLogMutation.isPending) ? "Sparar..." : "Set avklarat"}
            </Button>
            
            <Button
              size="lg"
              variant="default"
              className="bg-primary hover:bg-primary/90 shrink-0 w-14"
              onClick={() => setShowAddSetDialog(true)}
              disabled={createExerciseLogMutation.isPending || updateExerciseLogMutation.isPending || !urlSessionId}
              data-testid="button-add-extra-set"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>

          <AlertDialog open={showAddSetDialog} onOpenChange={setShowAddSetDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lägg till extra set?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vill du lägga till en till repetition av denna övning?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-extra-set">Nej</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleAddExtraSet}
                  data-testid="button-confirm-extra-set"
                >
                  Ja
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showBulkUpdateDialog} onOpenChange={setShowBulkUpdateDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Uppdatera återstående set?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vill du tillämpa dessa värden på alla återstående set för denna övning i detta pass?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={() => handleBulkUpdate(false)}
                  data-testid="button-cancel-bulk-update"
                >
                  Nej, bara detta set
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => handleBulkUpdate(true)}
                  data-testid="button-confirm-bulk-update"
                >
                  Ja, uppdatera alla
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showSmartRepDialog} onOpenChange={setShowSmartRepDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Öka vikten istället?</AlertDialogTitle>
                <AlertDialogDescription>
                  Med dina nuvarande träningsinställningar rekommenderar jag att du ökar vikten istället för antalet repetitioner. Vill du ändå uppdatera antal repetitioner på framtida set?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={() => handleBulkUpdate(true, true)}
                  data-testid="button-cancel-smart-rep"
                >
                  Nej, behåll planerade reps
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => handleBulkUpdate(true, false)}
                  data-testid="button-confirm-smart-rep"
                >
                  Ja, uppdatera ändå
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {exerciseVideo?.youtubeUrl && currentExercise && (
        <VideoPlayerDialog
          open={videoDialogOpen}
          onOpenChange={setVideoDialogOpen}
          exerciseName={currentExercise.exerciseName}
          youtubeUrl={exerciseVideo.youtubeUrl}
          videoType={exerciseVideo.videoType}
        />
      )}
    </div>
  );
}
