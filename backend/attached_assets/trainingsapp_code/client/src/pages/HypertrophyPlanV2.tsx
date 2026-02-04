import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, MonitorSmartphone, Play, ChevronLeft, ChevronRight, Check, X, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import confetti from "canvas-confetti";
import { RestTimer } from "@/components/RestTimer";

// Typer
type EstimatorId = "bench" | "ohp" | "deadlift" | "latpull";
type Sex = "male" | "female" | "other";

type Exercise = {
  key: string;
  title: string;
  prescription: string;
  video?: string;
  notes?: string;
  repMin?: number;
  repMax?: number;
  estimatorId?: EstimatorId;
};

type Superset = [Exercise, Exercise];

type Session = {
  id: "A" | "B" | "C";
  name: string;
  blurb: string;
  supersets: Superset[];
  finisher?: Exercise[];
  estMinutes: string;
};

type Media = { kind: "youtube"; id: string; start?: number };

// Media overrides
const MEDIA_OVERRIDES: Partial<Record<string, Media>> = {
  a1: { kind: "youtube", id: "ukDEXCXJxdM" },
  a2: { kind: "youtube", id: "xQNrFHEMhI4" },
  a3: { kind: "youtube", id: "DnV3R4vp3K0" },
  a4: { kind: "youtube", id: "rep-qVOkqgk" },
  a5: { kind: "youtube", id: "LT1Eo-q58yg" },
  a6: { kind: "youtube", id: "vB5OHsJ3EME" },
  a7: { kind: "youtube", id: "tgbrMdfuGJA" },
  a8: { kind: "youtube", id: "Fkzk_RqlYig" },
  b1: { kind: "youtube", id: "DJ7m-Eqwzdc" },
  b2: { kind: "youtube", id: "2C-uNgKwPLE" },
  b3: { kind: "youtube", id: "lueEJGjTuPQ" },
  b4: { kind: "youtube", id: "rwN_r4RZrns" },
  b5: { kind: "youtube", id: "TwD-YGVP4Bk" },
  b6: { kind: "youtube", id: "6dISKmboajU" },
  b7: { kind: "youtube", id: "pitOuJxdyI0" },
  c1: { kind: "youtube", id: "8E4oWpi0RkA" },
  c2: { kind: "youtube", id: "pYcpY20QaE8" },
  c3: { kind: "youtube", id: "aoP0s_MjN-g" },
  c6: { kind: "youtube", id: "mRozZKkGIfg" },
  c7: { kind: "youtube", id: "XIHO5t_VBPQ" },
  c8: { kind: "youtube", id: "F7otn_5JdqA" },
};

// Basprogram
const BASE_SESSIONS: Session[] = [
  {
    id: "A",
    name: "Pass A – Överkropp (press-bias + skulderhälsa)",
    blurb: "Superset för effektiv press + axelhälsa. Vila 60–90 s mellan övningarna.",
    supersets: [
      [
        { key: "a1", title: "Bänkpress eller hantelpress på bänk", prescription: "3×6–10", repMin: 6, repMax: 10, estimatorId: "bench" },
        { key: "a2", title: "Sittande rodd (kabel/maskin)", prescription: "3×8–12" },
      ],
      [
        { key: "a3", title: "Lutande hantelpress", prescription: "3×8–12", repMin: 8, repMax: 12, estimatorId: "bench" },
        { key: "a4", title: "Face pulls / band pull-aparts", prescription: "3×15–20" },
      ],
      [
        { key: "a5", title: "Hantel lateral raises", prescription: "3×10–15" },
        { key: "a6", title: "Triceps pushdown/dips (maskin)", prescription: "3×8–12" },
      ],
    ],
    finisher: [
      { key: "a7", title: "Planka", prescription: "2×40–60 s" },
      { key: "a8", title: "Farmer's walk", prescription: "2×30–40 m" },
    ],
    estMinutes: "≈42–47 min",
  },
  {
    id: "B",
    name: "Pass B – Ben & Rygg (drag-bias)",
    blurb: "Tunga höftdominanta lyft; vila ~2 min på baslyften.",
    supersets: [
      [
        { key: "b1", title: "Trap-bar marklyft eller rumänska marklyft", prescription: "3×5–8", repMin: 5, repMax: 8, estimatorId: "deadlift" },
        { key: "b1n", title: "—", prescription: "Baslyft – stående själv", notes: "Fokusera på neutral rygg." },
      ],
      [
        { key: "b2", title: "Bulgariska split squats", prescription: "3×8–12/ben" },
        { key: "b3", title: "Latdrag / Pull-ups", prescription: "3×6–10", repMin: 6, repMax: 10, estimatorId: "latpull" },
      ],
      [
        { key: "b4", title: "Ryggesningar 45°", prescription: "2–3×10–15" },
        { key: "b5", title: "Hantel hammercurls", prescription: "2–3×10–15" },
      ],
    ],
    finisher: [
      { key: "b6", title: "Pallof-press", prescription: "2×12/sida" },
      { key: "b7", title: "Sidoplanka", prescription: "2×30–45 s/sida" },
    ],
    estMinutes: "≈44–48 min",
  },
  {
    id: "C",
    name: "Pass C – Överkropp volym (axlar/armar + ryggstöd)",
    blurb: "Lätt/medel belastning, fokus på kontakt och pump.",
    supersets: [
      [
        { key: "c1", title: "Militärpress / hantelpress", prescription: "3×8–10", repMin: 8, repMax: 10, estimatorId: "ohp" },
        { key: "c1n", title: "—", prescription: "Stående själv" },
      ],
      [
        { key: "c2", title: "Enarme hantelrodd / bröststödd rodd", prescription: "3×8–12/arm" },
        { key: "c3", title: "Kabel- eller hantelflyes", prescription: "2–3×12–15" },
      ],
      [
        { key: "c4", title: "Rear-delt raise", prescription: "2–3×12–20" },
        { key: "c5", title: "EZ-bar / hantelcurl", prescription: "2–3×8–12" },
      ],
      [
        { key: "c6", title: "Rep OH triceps extension", prescription: "2–3×10–15" },
        { key: "c7", title: "Armhävningar AMRAP (1 set)", prescription: "AMRAP" },
      ],
    ],
    finisher: [
      { key: "c8", title: "Slädpush", prescription: "4×20 m" },
    ],
    estMinutes: "≈43–47 min",
  },
];

// Viktberäkning
function getWeightSuggestion(ex: Exercise, oneRM: Record<EstimatorId, number>, setNumber: number): string {
  if (!ex.estimatorId || !ex.repMin || !ex.repMax) return "";

  const rm = oneRM[ex.estimatorId];
  if (!rm || rm <= 0) return "";

  const targetReps = setNumber === 1 ? ex.repMin : ex.repMax;
  const percentage = 1.0278 - 0.0278 * targetReps;
  const weight = Math.round(rm * percentage * 2) / 2;

  return `Set ${setNumber}: ~${weight} kg (${targetReps} reps)`;
}

// Video embed
function VideoEmbed({ exKey }: { exKey: string }) {
  const media = MEDIA_OVERRIDES[exKey];
  if (!media || media.kind !== "youtube") return null;

  const startParam = media.start ? `&start=${media.start}` : "";
  return (
    <div className="video-embed">
      <iframe
        src={`https://www.youtube.com/embed/${media.id}?rel=0${startParam}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

// Celebration animation
function triggerCelebration() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    });
  }, 250);
}

// Sekventiell övningsvy med viktregistrering
interface SequentialExerciseViewProps {
  exercises: Exercise[];
  sessionName: string;
  sessionType: "A" | "B" | "C";
  oneRM: Record<EstimatorId, number>;
  onClose: () => void;
}

function SequentialExerciseView({ exercises, sessionName, sessionType, oneRM, onClose }: SequentialExerciseViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<number, boolean[]>>({});
  const [weights, setWeights] = useState<Record<number, Record<number, string>>>({});
  const [reps, setReps] = useState<Record<number, Record<number, string>>>({});
  const [showVideo, setShowVideo] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(60);

  const { user } = useAuth();
  const { data: profile } = trpc.workout.getProfile.useQuery(undefined, { enabled: !!user });
  const startSessionMutation = trpc.workout.startSession.useMutation();
  const completeSessionMutation = trpc.workout.completeSession.useMutation();
  const logExerciseMutation = trpc.workout.logExercise.useMutation();

  // Load rest time from profile
  useEffect(() => {
    if (profile?.restTime) {
      setRestDuration(profile.restTime);
    }
  }, [profile]);

  // Start session when component mounts
  useEffect(() => {
    if (user && !sessionId) {
      startSessionMutation.mutate(
        { sessionType },
        {
          onSuccess: (data) => {
            setSessionId(data.sessionId);
          },
        }
      );
    }
  }, [user, sessionType]);

  const currentEx = exercises[currentIndex];
  const totalExercises = exercises.length;
  const progress = ((currentIndex + 1) / totalExercises) * 100;
  const isLastExercise = currentIndex === totalExercises - 1;

  const getSetsCount = (prescription: string): number => {
    const match = prescription.match(/(\d+)×/);
    return match ? parseInt(match[1]) : 3;
  };

  const setsCount = getSetsCount(currentEx.prescription);
  const currentSets = completedSets[currentIndex] || Array(setsCount).fill(false);
  const currentWeights = weights[currentIndex] || {};
  const currentReps = reps[currentIndex] || {};

  const toggleSet = (setIndex: number) => {
    const newSets = [...currentSets];
    const wasCompleted = newSets[setIndex];
    newSets[setIndex] = !newSets[setIndex];
    setCompletedSets({ ...completedSets, [currentIndex]: newSets });

    // Start rest timer when marking a set as complete (not when unchecking)
    if (!wasCompleted && newSets[setIndex]) {
      // Don't start timer on last set of last exercise
      const isLastSet = setIndex === setsCount - 1;
      if (!isLastExercise || !isLastSet) {
        setShowRestTimer(true);
      }
    }

    // Log to database if session is active
    if (sessionId && user && newSets[setIndex]) {
      const weight = currentWeights[setIndex] ? parseInt(currentWeights[setIndex]) : undefined;
      const repCount = currentReps[setIndex] ? parseInt(currentReps[setIndex]) : undefined;

      logExerciseMutation.mutate({
        workoutSessionId: sessionId,
        exerciseKey: currentEx.key,
        exerciseTitle: currentEx.title,
        setNumber: setIndex + 1,
        weight,
        reps: repCount,
        completed: 1,
      });
    }
  };

  const updateWeight = (setIndex: number, value: string) => {
    setWeights({
      ...weights,
      [currentIndex]: { ...currentWeights, [setIndex]: value },
    });
  };

  const updateReps = (setIndex: number, value: string) => {
    setReps({
      ...reps,
      [currentIndex]: { ...currentReps, [setIndex]: value },
    });
  };

  const goNext = () => {
    if (currentIndex < totalExercises - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowVideo(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowVideo(false);
    }
  };

  const handleFinish = () => {
    if (sessionId) {
      completeSessionMutation.mutate(
        { sessionId },
        {
          onSuccess: () => {
            setShowCelebration(true);
            triggerCelebration();
            setTimeout(() => {
              onClose();
            }, 3500);
          },
        }
      );
    } else {
      // Fallback if no session
      setShowCelebration(true);
      triggerCelebration();
      setTimeout(() => {
        onClose();
      }, 3500);
    }
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && !isLastExercise) goNext();
    if (isRightSwipe) goPrev();
  };

  // Check if all sets are completed
  const allSetsCompleted = currentSets.every(s => s);

  if (showRestTimer) {
    return (
      <RestTimer
        duration={restDuration}
        onComplete={() => setShowRestTimer(false)}
        onSkip={() => setShowRestTimer(false)}
      />
    );
  }

  if (showCelebration) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <PartyPopper className="h-24 w-24 mx-auto text-primary animate-bounce" />
          <h1 className="text-4xl font-bold">Grattis!</h1>
          <p className="text-xl text-muted-foreground">Du klarade passet! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col safe-area">
      <div className="sticky-header p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold truncate flex-1">{sessionName}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Övning {currentIndex + 1} av {totalExercises}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentEx.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-base px-3 py-1">
                {currentEx.prescription}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Set tracking with weight and reps */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Registrera set:</Label>
              {Array.from({ length: setsCount }).map((_, i) => (
                <div key={i} className="space-y-2 p-3 bg-secondary/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Set {i + 1}</Label>
                    <Button
                      variant={currentSets[i] ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSet(i)}
                    >
                      {currentSets[i] && <Check className="mr-1 h-4 w-4" />}
                      {currentSets[i] ? "Klart" : "Markera"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Vikt (kg)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={currentWeights[i] || ""}
                        onChange={(e) => updateWeight(i, e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Reps</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={currentReps[i] || ""}
                        onChange={(e) => updateReps(i, e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {currentEx.estimatorId && (
              <div className="space-y-2 p-3 bg-secondary/50 rounded-lg">
                <Label className="text-sm font-medium">Viktsförslag:</Label>
                <div className="space-y-1 text-sm">
                  <div>{getWeightSuggestion(currentEx, oneRM, 1)}</div>
                  <div>{getWeightSuggestion(currentEx, oneRM, 2)}</div>
                </div>
              </div>
            )}

            {currentEx.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{currentEx.notes}</p>
              </div>
            )}

            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 text-base"
              onClick={() => setShowVideo(!showVideo)}
            >
              <Play className="mr-2 h-5 w-5" />
              {showVideo ? "Dölj video" : "Visa instruktionsvideo"}
            </Button>

            {showVideo && <VideoEmbed exKey={currentEx.key} />}
          </CardContent>
        </Card>
      </div>

      <div className="sticky-footer p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 text-base"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            Föregående
          </Button>
          {isLastExercise ? (
            <Button
              size="lg"
              className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700"
              onClick={handleFinish}
              disabled={!allSetsCompleted}
            >
              <PartyPopper className="mr-2 h-5 w-5" />
              Pass klart!
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1 h-14 text-base"
              onClick={goNext}
            >
              Nästa
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          {isLastExercise ? "Slutför alla set för att avsluta" : "Swipe för att byta övning"}
        </p>
      </div>
    </div>
  );
}

// Session Card
interface SessionCardProps {
  s: Session;
  oneRM: Record<EstimatorId, number>;
  onStartWorkout: (exercises: Exercise[], sessionType: "A" | "B" | "C") => void;
}

function SessionCard({ s, oneRM, onStartWorkout }: SessionCardProps) {
  const allExercises: Exercise[] = [
    ...s.supersets.flatMap(ss => ss),
    ...(s.finisher || [])
  ].filter(ex => ex.title !== "—");

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg md:text-xl">{s.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{s.blurb}</p>
            <Badge variant="secondary" className="mt-2">{s.estMinutes}</Badge>
          </div>
          <Button
            size="lg"
            className="w-full md:w-auto h-12 text-base"
            onClick={() => onStartWorkout(allExercises, s.id)}
          >
            <Play className="mr-2 h-5 w-5" />
            Starta träning
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Övningar ({allExercises.length}):</Label>
          <div className="grid gap-2">
            {allExercises.map((ex, idx) => (
              <div key={ex.key} className="flex items-start gap-2 p-2 bg-secondary/30 rounded text-sm">
                <span className="font-medium text-muted-foreground min-w-[24px]">{idx + 1}.</span>
                <div className="flex-1">
                  <div className="font-medium">{ex.title}</div>
                  <div className="text-xs text-muted-foreground">{ex.prescription}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main component
export default function HypertrophyPlanV2() {
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<Sex>("male");
  const [bodyWeight, setBodyWeight] = useState(80);
  const [oneRM, setOneRM] = useState<Record<EstimatorId, number>>({
    bench: 80,
    ohp: 60,
    deadlift: 120,
    latpull: 70,
  });

  const [workoutMode, setWorkoutMode] = useState<{
    active: boolean;
    exercises: Exercise[];
    sessionName: string;
    sessionType: "A" | "B" | "C";
  } | null>(null);

  const { user, loading } = useAuth();

  const startWorkout = (exercises: Exercise[], sessionType: "A" | "B" | "C") => {
    const session = BASE_SESSIONS.find(s => s.id === sessionType);
    if (!session) return;

    setWorkoutMode({
      active: true,
      exercises,
      sessionName: session.name,
      sessionType,
    });
  };

  const closeWorkout = () => {
    setWorkoutMode(null);
  };

  if (workoutMode?.active) {
    return (
      <SequentialExerciseView
        exercises={workoutMode.exercises}
        sessionName={workoutMode.sessionName}
        sessionType={workoutMode.sessionType}
        oneRM={oneRM}
        onClose={closeWorkout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Hypertrophy Plan – 45 min</h1>
          <p className="text-muted-foreground">
            För dead överlappssvolym • starka ben/rygg • 2-3 pass/vecka
          </p>
        </div>

        <Tabs defaultValue="pass" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pass">Pass</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="nutrition">Näring</TabsTrigger>
            <TabsTrigger value="1rm">1RM</TabsTrigger>
            <TabsTrigger value="profile">Profil</TabsTrigger>
          </TabsList>

          <TabsContent value="pass" className="space-y-4 mt-6">
            {BASE_SESSIONS.map((s) => (
              <SessionCard key={s.id} s={s} oneRM={oneRM} onStartWorkout={startWorkout} />
            ))}
          </TabsContent>

          <TabsContent value="plan" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Träningsplan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Detta är ett 3-dagars split-program för hypertrofi. Träna 2-3 gånger per vecka med minst en vilodag mellan passen.
                </p>
                <div className="space-y-2">
                  <h3 className="font-semibold">Veckoschema:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Måndag: Pass A</li>
                    <li>Onsdag: Pass B</li>
                    <li>Fredag: Pass C</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nutrition" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Näringsriktlinjer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  För optimal muskeltillväxt, sikta på ett kaloriöverskott på 200-300 kcal per dag.
                </p>
                <div className="space-y-2">
                  <h3 className="font-semibold">Makrofördelning:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Protein: 1.6-2.2 g per kg kroppsvikt</li>
                    <li>Fett: 0.8-1.0 g per kg kroppsvikt</li>
                    <li>Kolhydrater: Resterande kalorier</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="1rm" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>1RM-kalkylator</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ange dina 1RM-värden för att få viktrekommendationer
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bänkpress 1RM (kg)</Label>
                    <Input
                      type="number"
                      value={oneRM.bench}
                      onChange={(e) => setOneRM({ ...oneRM, bench: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Militärpress 1RM (kg)</Label>
                    <Input
                      type="number"
                      value={oneRM.ohp}
                      onChange={(e) => setOneRM({ ...oneRM, ohp: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marklyft 1RM (kg)</Label>
                    <Input
                      type="number"
                      value={oneRM.deadlift}
                      onChange={(e) => setOneRM({ ...oneRM, deadlift: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Latdrag 1RM (kg)</Label>
                    <Input
                      type="number"
                      value={oneRM.latpull}
                      onChange={(e) => setOneRM({ ...oneRM, latpull: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hantera din kompletta profil med BMI-uträkning, träningsmål och inställningar.
                </p>
                <Button
                  onClick={() => window.location.href = "/profile"}
                  size="lg"
                  className="w-full"
                >
                  Öppna profilsida
                </Button>
                {user && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Inloggad som: <span className="font-medium">{user.name || user.email}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-center text-muted-foreground pt-4 border-t">
          <p>
            <strong>Observera:</strong> Denna app är för informationssyften och ersätter inte medicinsk rådgivning. Anpassa vikter/övningar efter din dagform och eventuella skador. Vid smärta – avbryt!
          </p>
        </div>
      </div>
    </div>
  );
}
