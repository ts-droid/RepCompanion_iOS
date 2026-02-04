import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, MonitorSmartphone, Play, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        { key: "b3", title: "Latsdrag / Pull-ups", prescription: "3×6–10", repMin: 6, repMax: 10, estimatorId: "latpull" },
      ],
      [
        { key: "b4", title: "Ryggresningar 45°", prescription: "2–3×10–15" },
        { key: "b5", title: "Hantel hammercurls", prescription: "2–3×10–15" },
      ],
    ],
    finisher: [
      { key: "b6", title: "Pallof-press", prescription: "2×12/side" },
      { key: "b7", title: "Sidoplanka", prescription: "2×30–45 s/side" },
    ],
    estMinutes: "≈44–48 min",
  },
  {
    id: "C",
    name: "Pass C – Överkropp volym (axlar/armar + ryggstöd)",
    blurb: "Lätt/medel belastning, fokus på kontakt och pump.",
    supersets: [
      [
        { key: "c1", title: "Militärpress / hantelpress", prescription: "3×6–10", repMin: 6, repMax: 10, estimatorId: "ohp" },
        { key: "c2", title: "Enarms hantelrodd / bröststödd rodd", prescription: "3×8–12/arm" },
      ],
      [
        { key: "c3", title: "Kabel- eller hantelflyes", prescription: "2–3×12–15" },
        { key: "c4", title: "Rear-delt raise", prescription: "2–3×12–20" },
      ],
      [
        { key: "c5", title: "EZ‑bar / hantelcurl", prescription: "2–3×8–12" },
        { key: "c6", title: "Rep OH triceps extension", prescription: "2–3×10–15" },
      ],
    ],
    finisher: [
      { key: "c7", title: "Armhävningar AMRAP (1 set)", prescription: "AMRAP" },
      { key: "c8", title: "Slädpush", prescription: "4×20 m" },
    ],
    estMinutes: "≈43–47 min",
  },
];

const warmRules: string[] = [
  "5–7 min lätt rodd/cykel → dynamisk rörlighet axlar/höfter → 2 set band pull‑aparts + glute bridges (12–15)",
  "Intensitet: RPE 7–9 (≈1–3 reps i tanken). Vila 60–90 s (assistans) och 90–120 s (baslyft)",
  "Tempo: ~2 s kontrollerad sänkning, kraftfull men kontrollerad upp",
  "Progression: nå övre rep‑gränsen i alla set → höj vikt (UB +2–5 kg, LB +5–10 kg; hantlar +1–2 kg)",
  "Deload var 5–6:e vecka: volym −50 % eller vikt −10–15 %",
];

// Hjälpfunktioner
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function adaptRepRange(min: number | undefined, max: number | undefined, age: number, sex: Sex): { min?: number; max?: number } {
  if (!min || !max) return { min, max };
  let newMin = min;
  let newMax = max;
  if (sex === "female") {
    newMin += 2;
    newMax += 2;
  }
  if (age >= 55) {
    newMin = clamp(newMin - 1, 5, 100);
    newMax = clamp(newMax - 2, newMin, 100);
  }
  return { min: newMin, max: newMax };
}

function updatePrescriptionText(original: string, newMin?: number, newMax?: number): string {
  if (!newMin || !newMax) return original;
  const match = original.match(/(\d+)×(\d+)(?:–(\d+))?/);
  if (!match) return original;
  const sets = match[1];
  return `${sets}×${newMin}–${newMax}`;
}

function estimateWeight(oneRM: number, reps: number, rir: number): number {
  if (oneRM <= 0) return 0;
  const totalReps = reps + rir;
  const weight = oneRM / (1 + totalReps / 30);
  return Math.round(weight * 2) / 2;
}

function getWeightSuggestion(ex: Exercise, oneRM: Record<EstimatorId, number>, week: 1 | 2): string {
  if (!ex.estimatorId || !ex.repMin || !ex.repMax) return "";
  const rm = oneRM[ex.estimatorId];
  if (!rm || rm <= 0) return "";

  const rir = week === 1 ? 3 : 2;
  const midRep = Math.round((ex.repMin + ex.repMax) / 2);
  const targetRep = week === 1 ? midRep : midRep + 1;
  const weight = estimateWeight(rm, targetRep, rir);

  return weight > 0 ? `Vecka ${week}: ~${weight} kg (${targetRep} reps, RPE ${week === 1 ? 7 : 8})` : "";
}

// Video Component
function VideoEmbed({ exKey }: { exKey: string }) {
  const media = MEDIA_OVERRIDES[exKey];
  if (!media) return null;

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

// Sekventiell övningsvy
interface SequentialExerciseViewProps {
  exercises: Exercise[];
  sessionName: string;
  oneRM: Record<EstimatorId, number>;
  onClose: () => void;
}

function SequentialExerciseView({ exercises, sessionName, oneRM, onClose }: SequentialExerciseViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<number, boolean[]>>({});
  const [showVideo, setShowVideo] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const currentEx = exercises[currentIndex];
  const totalExercises = exercises.length;
  const progress = ((currentIndex + 1) / totalExercises) * 100;

  const getSetsCount = (prescription: string): number => {
    const match = prescription.match(/(\d+)×/);
    return match ? parseInt(match[1]) : 3;
  };

  const setsCount = getSetsCount(currentEx.prescription);
  const currentSets = completedSets[currentIndex] || Array(setsCount).fill(false);

  const toggleSet = (setIndex: number) => {
    const newSets = [...currentSets];
    newSets[setIndex] = !newSets[setIndex];
    setCompletedSets({ ...completedSets, [currentIndex]: newSets });
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

    if (isLeftSwipe) goNext();
    if (isRightSwipe) goPrev();
  };

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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Markera avklarade set:</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: setsCount }).map((_, i) => (
                  <Button
                    key={i}
                    variant={currentSets[i] ? "default" : "outline"}
                    size="lg"
                    className="flex-1 min-w-[60px] h-12 text-base"
                    onClick={() => toggleSet(i)}
                  >
                    {currentSets[i] && <Check className="mr-1 h-4 w-4" />}
                    Set {i + 1}
                  </Button>
                ))}
              </div>
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
          <Button
            size="lg"
            className="flex-1 h-14 text-base"
            onClick={goNext}
            disabled={currentIndex === totalExercises - 1}
          >
            Nästa
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Swipe för att byta övning
        </p>
      </div>
    </div>
  );
}

// Session Card
interface SessionCardProps {
  s: Session;
  oneRM: Record<EstimatorId, number>;
  onStartWorkout: (exercises: Exercise[]) => void;
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
            onClick={() => onStartWorkout(allExercises)}
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

// Main App
export default function HypertrophyPlanApp() {
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<Sex>("male");
  const [bodyWeight, setBodyWeight] = useState(80);
  const [oneRM, setOneRM] = useState<Record<EstimatorId, number>>({
    bench: 100,
    ohp: 60,
    deadlift: 160,
    latpull: 90,
  });

  const [workoutMode, setWorkoutMode] = useState(false);
  const [currentWorkout, setCurrentWorkout] = useState<{ exercises: Exercise[]; sessionName: string } | null>(null);

  const proteinMin = Math.round(bodyWeight * 1.6);
  const proteinMax = Math.round(bodyWeight * 2.2);

  const SESSIONS = useMemo<Session[]>(() => {
    return BASE_SESSIONS.map((s) => {
      const newBlurb = age >= 55
        ? s.blurb.replace(/Vila[^.]*\./, "Vila 90–120 s mellan seten.") || `${s.blurb} Vila 90–120 s mellan seten.`
        : s.blurb;

      const mapEx = (ex: Exercise): Exercise => {
        const { min, max } = adaptRepRange(ex.repMin, ex.repMax, age, sex);
        const newPresc = updatePrescriptionText(ex.prescription, min, max);
        return {
          ...ex,
          prescription: newPresc,
          repMin: min ?? ex.repMin,
          repMax: max ?? ex.repMax,
        };
      };

      return {
        ...s,
        blurb: newBlurb,
        supersets: s.supersets.map(([e1, e2]) => [mapEx(e1), mapEx(e2)] as Superset),
        finisher: s.finisher ? s.finisher.map(mapEx) : undefined,
      };
    });
  }, [age, sex]);

  const closeWorkout = () => {
    setWorkoutMode(false);
    setCurrentWorkout(null);
  };

  if (workoutMode && currentWorkout) {
    return (
      <SequentialExerciseView
        exercises={currentWorkout.exercises}
        sessionName={currentWorkout.sessionName}
        oneRM={oneRM}
        onClose={closeWorkout}
      />
    );
  }

  return (
    <div className="safe-area max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Hypertrophy Plan – 45 min
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            För ökad överkroppsvolym + starka ben/rygg • 2–3 pass/vecka
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Ålder: {age}</Badge>
          <Badge variant="secondary">
            Kön: {sex === "male" ? "Man" : sex === "female" ? "Kvinna" : "Annat"}
          </Badge>
          <Badge variant="secondary">Vikt: {bodyWeight} kg</Badge>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full h-auto">
          <TabsTrigger value="sessions" className="text-xs md:text-sm py-2">
            Pass
          </TabsTrigger>
          <TabsTrigger value="plan" className="text-xs md:text-sm py-2">
            Plan
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="text-xs md:text-sm py-2">
            Näring
          </TabsTrigger>
          <TabsTrigger value="oneRM" className="text-xs md:text-sm py-2">
            1RM
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs md:text-sm py-2">
            Profil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4 mt-4">
          {SESSIONS.map((s) => (
            <SessionCard
              key={s.id}
              s={s}
              oneRM={oneRM}
              onStartWorkout={(exercises) => {
                setCurrentWorkout({ exercises, sessionName: s.name });
                setWorkoutMode(true);
              }}
            />
          ))}
        </TabsContent>

        <TabsContent value="plan" className="space-y-4 mt-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Uppvärmning & Grundregler</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                {warmRules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nutrition" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Kost för volym</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Vikt (kg)</Label>
                  <Input
                    type="number"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(Number(e.target.value || 0))}
                    className="h-11 text-base"
                  />
                </div>
                <div className="md:col-span-2 p-3 bg-secondary/50 rounded-lg">
                  <div className="text-sm mb-1">Proteinmål:</div>
                  <div className="text-lg font-medium">{proteinMin}–{proteinMax} g/dag</div>
                  <div className="text-xs text-muted-foreground">(1,6–2,2 g/kg)</div>
                </div>
              </div>

              <Separator />

              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Protein: 1,6–2,2 g/kg/dag ({proteinMin}–{proteinMax} g/dag vid {bodyWeight} kg).</li>
                <li>Kalorier: lätt överskott om målet är volym. Justera efter tid och resultat.</li>
                <li>Sömn: 7–8 h/natt. Steg: 6–10k/dag.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oneRM" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Viktsprofil (1RM‑estimat)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>1RM – Bänkpress (kg)</Label>
                  <Input
                    type="number"
                    placeholder="ex 100"
                    value={oneRM.bench || ""}
                    onChange={(e) => setOneRM((p) => ({ ...p, bench: Math.max(0, Number(e.target.value || 0)) }))}
                    className="h-11 text-base"
                  />
                </div>
                <div>
                  <Label>1RM – Militärpress (kg)</Label>
                  <Input
                    type="number"
                    placeholder="ex 60"
                    value={oneRM.ohp || ""}
                    onChange={(e) => setOneRM((p) => ({ ...p, ohp: Math.max(0, Number(e.target.value || 0)) }))}
                    className="h-11 text-base"
                  />
                </div>
                <div>
                  <Label>1RM – Trap‑bar/RDL (kg)</Label>
                  <Input
                    type="number"
                    placeholder="ex 160"
                    value={oneRM.deadlift || ""}
                    onChange={(e) => setOneRM((p) => ({ ...p, deadlift: Math.max(0, Number(e.target.value || 0)) }))}
                    className="h-11 text-base"
                  />
                </div>
                <div>
                  <Label>1RM – Latsdrag (kg)</Label>
                  <Input
                    type="number"
                    placeholder="ex 90"
                    value={oneRM.latpull || ""}
                    onChange={(e) => setOneRM((p) => ({ ...p, latpull: Math.max(0, Number(e.target.value || 0)) }))}
                    className="h-11 text-base"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                <strong>Algoritm:</strong> <code>vikt = 1RM / (1 + (reps + RIR)/30)</code>
                <br />
                Vecka 1 siktar på RPE 7 (RIR 3) med mitt‑reps. Vecka 2 siktar på RPE 8 (RIR 2) med +1 rep.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Profil & Anpassning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Ålder</Label>
                  <Input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Math.max(0, Number(e.target.value || 0)))}
                    className="h-11 text-base"
                  />
                </div>
                <div>
                  <Label>Kön</Label>
                  <select
                    className="w-full h-11 rounded-md border border-input bg-background px-3 text-base"
                    value={sex}
                    onChange={(e) => setSex((e.target.value as Sex) || "other")}
                  >
                    <option value="male">Man</option>
                    <option value="female">Kvinna</option>
                    <option value="other">Annat / föredrar ej säga</option>
                  </select>
                </div>
                <div>
                  <Label>Vikt (kg)</Label>
                  <Input
                    type="number"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(Number(e.target.value || 0))}
                    className="h-11 text-base"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                <strong>Anpassningsregler:</strong> Kvinnor: +2 reps på angivna intervall.
                55+ år: något lägre reps och längre vila i passbeskrivningen.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground mt-6 p-3 bg-muted rounded-lg">
        <strong>Observera:</strong> Denna app är för informationssyfte och ersätter inte medicinsk rådgivning.
        Anpassa vikter/övningar efter din dagsform och eventuella skador. Vid smärta – avbryt.
      </p>
    </div>
  );
}
