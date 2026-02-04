import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import type { UserProfile } from "@shared/schema";
import ProgramBuildingAnimation from "@/components/ProgramBuildingAnimation";

const LoadingAnimation = () => {
  return (
    <div className="flex items-center justify-center gap-3" data-testid="loading-animation">
      <motion.div
        className="w-6 h-6 rounded-full border-2 border-background"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--accent))",
        }}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.span
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        Genererar nya pass...
      </motion.span>
    </div>
  );
};

export default function AdjustTraining() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [motivationType, setMotivationType] = useState<string>("");
  const [trainingLevel, setTrainingLevel] = useState<string>("");
  const [specificSport, setSpecificSport] = useState<string>("");
  const [goalStrength, setGoalStrength] = useState(25);
  const [goalVolume, setGoalVolume] = useState(25);
  const [goalEndurance, setGoalEndurance] = useState(25);
  const [goalCardio, setGoalCardio] = useState(25);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(60);
  
  // 1RM values
  const [oneRmBench, setOneRmBench] = useState<number>(0);
  const [oneRmOhp, setOneRmOhp] = useState<number>(0);
  const [oneRmDeadlift, setOneRmDeadlift] = useState<number>(0);
  const [oneRmSquat, setOneRmSquat] = useState<number>(0);
  const [oneRmLatpull, setOneRmLatpull] = useState<number>(0);

  // 30-second notification when generation takes longer
  useEffect(() => {
    if (!isGenerating) return;
    
    const timer = setTimeout(() => {
      toast({
        title: "Många tränar just nu...",
        description: "Programmet genereras, vänta lite. Detta kan ta upp till 2 minuter.",
        duration: 8000,
      });
    }, 30000); // 30 seconds
    
    return () => clearTimeout(timer);
  }, [isGenerating, toast]);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  // Förifyll befintliga värden när profilen laddas
  useEffect(() => {
    if (profile) {
      setMotivationType(profile.motivationType || "");
      setTrainingLevel(profile.trainingLevel || "");
      setSpecificSport(profile.specificSport || "");
      
      // Normalize goals to ensure they sum to 100%
      const str = profile.goalStrength || 25;
      const vol = profile.goalVolume || 25;
      const end = profile.goalEndurance || 25;
      const car = profile.goalCardio || 25;
      const total = str + vol + end + car;
      
      if (total > 0) {
        setGoalStrength(Math.round((str / total) * 100));
        setGoalVolume(Math.round((vol / total) * 100));
        setGoalEndurance(Math.round((end / total) * 100));
        setGoalCardio(Math.round((car / total) * 100));
      } else {
        setGoalStrength(25);
        setGoalVolume(25);
        setGoalEndurance(25);
        setGoalCardio(25);
      }
      
      setSessionsPerWeek(profile.sessionsPerWeek || 3);
      setSessionDuration(profile.sessionDuration || 60);
      setOneRmBench(profile.oneRmBench || 0);
      setOneRmOhp(profile.oneRmOhp || 0);
      setOneRmDeadlift(profile.oneRmDeadlift || 0);
      setOneRmSquat(profile.oneRmSquat || 0);
      setOneRmLatpull(profile.oneRmLatpull || 0);
    }
  }, [profile]);

  // Helper function to distribute values to sum to 100%
  const distributeGoals = (
    changedGoal: 'strength' | 'volume' | 'endurance' | 'cardio',
    newValue: number
  ) => {
    const current = {
      strength: goalStrength,
      volume: goalVolume,
      endurance: goalEndurance,
      cardio: goalCardio,
    };
    
    // Calculate how much we need to distribute among the other three
    const remaining = 100 - newValue;
    
    // Get the current values of the other three goals
    const otherGoals = Object.entries(current).filter(([key]) => key !== changedGoal);
    const otherTotal = otherGoals.reduce((sum, [, val]) => sum + val, 0);
    
    // Distribute proportionally among the other goals
    const distributed: Record<string, number> = { [changedGoal]: newValue };
    
    if (otherTotal > 0) {
      otherGoals.forEach(([key, val]) => {
        distributed[key] = Math.round((val / otherTotal) * remaining);
      });
    } else {
      // If other goals are all 0, distribute equally
      const equalShare = Math.round(remaining / 3);
      otherGoals.forEach(([key]) => {
        distributed[key] = equalShare;
      });
    }
    
    // Adjust for rounding errors to ensure sum is exactly 100
    const sum = Object.values(distributed).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const diff = 100 - sum;
      const firstOther = otherGoals[0][0];
      distributed[firstOther] = (distributed[firstOther] || 0) + diff;
    }
    
    setGoalStrength(distributed.strength);
    setGoalVolume(distributed.volume);
    setGoalEndurance(distributed.endurance);
    setGoalCardio(distributed.cardio);
  };

  const totalSteps = motivationType === "sport" ? 6 : 5;
  const progressPercentage = (step / totalSteps) * 100;


  const { data: generationLimit } = useQuery<{
    allowed: boolean;
    remaining: number;
    total: number;
    resetDate: string | null;
  }>({
    queryKey: ["/api/profile/generation-limit"],
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!motivationType || !trainingLevel || sessionsPerWeek < 1 || sessionsPerWeek > 7 || sessionDuration < 15) {
        throw new Error("Vänligen fyll i alla fält korrekt");
      }
      
      // Validate that specificSport is selected when motivation is sport
      if (motivationType === "sport" && !specificSport) {
        throw new Error("Vänligen välj en sport");
      }

      const payload: any = {
        motivationType,
        trainingLevel,
        goalStrength: Math.max(0, Math.min(100, goalStrength)),
        goalVolume: Math.max(0, Math.min(100, goalVolume)),
        goalEndurance: Math.max(0, Math.min(100, goalEndurance)),
        goalCardio: Math.max(0, Math.min(100, goalCardio)),
        sessionsPerWeek: Math.max(1, Math.min(7, sessionsPerWeek)),
        sessionDuration: Math.max(15, Math.min(180, sessionDuration)),
        oneRmBench: oneRmBench > 0 ? oneRmBench : undefined,
        oneRmOhp: oneRmOhp > 0 ? oneRmOhp : undefined,
        oneRmDeadlift: oneRmDeadlift > 0 ? oneRmDeadlift : undefined,
        oneRmSquat: oneRmSquat > 0 ? oneRmSquat : undefined,
        oneRmLatpull: oneRmLatpull > 0 ? oneRmLatpull : undefined,
        forceRegenerate: true, // Always regenerate programs when this button is clicked
      };

      if (motivationType === "sport" && specificSport) {
        payload.specificSport = specificSport;
      } else {
        // Clear specificSport when motivation is not sport
        payload.specificSport = null;
      }

      setIsGenerating(true);
      return await apiRequest("PATCH", "/api/profile", payload);
    },
    onSuccess: async () => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/generation-limit"] });
      
      toast({
        title: "Nya pass genererade!",
        description: "Dina träningsprogram har uppdaterats baserat på dina nya inställningar",
      });
      
      setLocation("/");
    },
    onError: (error: any) => {
      setIsGenerating(false);
      if (error.message?.includes("gränsen")) {
        toast({
          title: "Generering blockerad",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fel",
          description: error.message || "Kunde inte uppdatera inställningar",
          variant: "destructive",
        });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => step === 1 ? setLocation("/profile") : setStep(step - 1)}
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 h-1 bg-muted rounded-full overflow-visible">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">💪</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Vad motiverar dig att träna?
              </h1>
              <p className="text-muted-foreground">
                Välj ditt primära träningsmål
              </p>
            </div>

            <div className="space-y-4">
              {[
                { value: "fitness", title: "Fitness", desc: "Komma i form och må bättre" },
                { value: "rehabilitering", title: "Rehabilitering", desc: "Återhämta och stärka efter skada" },
                { value: "hälsa_livsstil", title: "Hälsa & Livsstil", desc: "Träna med ett program som passar din situation" },
                { value: "sport", title: "Sport", desc: "Förbättra prestationen i din sport" }
              ].map((option) => (
                <Card
                  key={option.value}
                  className={`p-6 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                    motivationType === option.value ? "border-primary border-2" : ""
                  }`}
                  onClick={() => setMotivationType(option.value)}
                  data-testid={`option-motivation-${option.value}`}
                >
                  <h3 className="font-semibold text-foreground mb-1">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </Card>
              ))}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(2)}
              disabled={!motivationType}
              data-testid="button-continue-motivation"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 2 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">⚽</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Vilken sport tränar du?
              </h1>
              <p className="text-muted-foreground">
                Välj din huvudsport
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Fotboll", 
                "Innebandy", 
                "Golf", 
                "Ishockey", 
                "Längdskidåkning", 
                "Tennis", 
                "Simning", 
                "Basket", 
                "Handboll", 
                "Kampsport"
              ].map((sport) => (
                <Card
                  key={sport}
                  className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                    specificSport === sport ? "border-primary border-2" : ""
                  }`}
                  onClick={() => setSpecificSport(sport)}
                  data-testid={`option-sport-${sport.toLowerCase()}`}
                >
                  <h3 className="font-medium text-foreground">{sport}</h3>
                </Card>
              ))}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(3)}
              disabled={!specificSport}
              data-testid="button-continue-sport"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 2 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">📊</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Vilken är din träningsnivå?
              </h1>
              <p className="text-muted-foreground">
                Detta hjälper oss att anpassa programmet
              </p>
            </div>

            <div className="space-y-4">
              {[
                { value: "nybörjare", title: "Nybörjare", desc: "Ny till träning eller återkommer efter lång paus" },
                { value: "van", title: "Van", desc: "Tränat regelbundet i 6+ månader" },
                { value: "mycket_van", title: "Mycket van", desc: "Tränat konsekvent i 2+ år" },
                { value: "elit", title: "Elit", desc: "Professionell eller tävlingsidrottare" }
              ].map((option) => (
                <Card
                  key={option.value}
                  className={`p-6 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                    trainingLevel === option.value ? "border-primary border-2" : ""
                  }`}
                  onClick={() => setTrainingLevel(option.value)}
                  data-testid={`option-level-${option.value}`}
                >
                  <h3 className="font-semibold text-foreground mb-1">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </Card>
              ))}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(3)}
              disabled={!trainingLevel}
              data-testid="button-continue-level"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 3 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">📊</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Vilken är din träningsnivå?
              </h1>
              <p className="text-muted-foreground">
                Hur erfaren är du inom {specificSport}?
              </p>
            </div>

            <div className="space-y-4">
              {[
                { value: "nybörjare", title: "Nybörjare", desc: "Ny till sporten eller återkommer efter lång paus" },
                { value: "van", title: "Van", desc: "Tränat regelbundet i 6+ månader" },
                { value: "mycket_van", title: "Mycket van", desc: "Tränat konsekvent i 2+ år" },
                { value: "elit", title: "Elit", desc: "Professionell eller tävlingsidrottare" }
              ].map((option) => (
                <Card
                  key={option.value}
                  className={`p-6 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                    trainingLevel === option.value ? "border-primary border-2" : ""
                  }`}
                  onClick={() => setTrainingLevel(option.value)}
                  data-testid={`option-level-${option.value}`}
                >
                  <h3 className="font-semibold text-foreground mb-1">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </Card>
              ))}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(4)}
              disabled={!trainingLevel}
              data-testid="button-continue-sport-level"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 3 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Träningsmål
              </h1>
              <p className="text-muted-foreground text-sm">
                Justera reglagen för att ställa in ditt träningsfokus
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Styrka</label>
                  <span className="text-muted-foreground">{goalStrength}%</span>
                </div>
                <Slider
                  value={[goalStrength]}
                  onValueChange={(value) => distributeGoals('strength', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-strength"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Volym</label>
                  <span className="text-muted-foreground">{goalVolume}%</span>
                </div>
                <Slider
                  value={[goalVolume]}
                  onValueChange={(value) => distributeGoals('volume', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-volume"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Uthållighet</label>
                  <span className="text-muted-foreground">{goalEndurance}%</span>
                </div>
                <Slider
                  value={[goalEndurance]}
                  onValueChange={(value) => distributeGoals('endurance', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-endurance"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Kondition</label>
                  <span className="text-muted-foreground">{goalCardio}%</span>
                </div>
                <Slider
                  value={[goalCardio]}
                  onValueChange={(value) => distributeGoals('cardio', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-cardio"
                />
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(4)}
              data-testid="button-continue-goals"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 4 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Träningsmål
              </h1>
              <p className="text-muted-foreground text-sm">
                Justera reglagen för att ställa in ditt träningsfokus
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Styrka</label>
                  <span className="text-muted-foreground">{goalStrength}%</span>
                </div>
                <Slider
                  value={[goalStrength]}
                  onValueChange={(value) => distributeGoals('strength', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-strength"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Volym</label>
                  <span className="text-muted-foreground">{goalVolume}%</span>
                </div>
                <Slider
                  value={[goalVolume]}
                  onValueChange={(value) => distributeGoals('volume', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-volume"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Uthållighet</label>
                  <span className="text-muted-foreground">{goalEndurance}%</span>
                </div>
                <Slider
                  value={[goalEndurance]}
                  onValueChange={(value) => distributeGoals('endurance', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-endurance"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-foreground font-medium">Kondition</label>
                  <span className="text-muted-foreground">{goalCardio}%</span>
                </div>
                <Slider
                  value={[goalCardio]}
                  onValueChange={(value) => distributeGoals('cardio', value[0])}
                  max={100}
                  step={5}
                  data-testid="slider-cardio"
                />
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(5)}
              data-testid="button-continue-sport-goals"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 4 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Träningsschema
              </h1>
              <p className="text-muted-foreground text-sm">
                Hur ofta och hur länge vill du träna?
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-foreground font-medium">
                  Pass per vecka
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSessionsPerWeek(num)}
                      className={`h-12 rounded-md border transition-all hover-elevate active-elevate-2 ${
                        sessionsPerWeek === num
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-card-border text-foreground"
                      }`}
                      data-testid={`button-sessions-${num}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-foreground font-medium">
                  Passlängd (minuter)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 45, 60, 90].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => setSessionDuration(duration)}
                      className={`h-12 rounded-md border transition-all hover-elevate active-elevate-2 ${
                        sessionDuration === duration
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-card-border text-foreground"
                      }`}
                      data-testid={`button-duration-${duration}`}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(5)}
              data-testid="button-continue-schedule"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 5 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Träningsschema
              </h1>
              <p className="text-muted-foreground text-sm">
                Hur ofta och hur länge vill du träna?
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-foreground font-medium">
                  Pass per vecka
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSessionsPerWeek(num)}
                      className={`h-12 rounded-md border transition-all hover-elevate active-elevate-2 ${
                        sessionsPerWeek === num
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-card-border text-foreground"
                      }`}
                      data-testid={`button-sessions-${num}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-foreground font-medium">
                  Passlängd (minuter)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 45, 60, 90].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => setSessionDuration(duration)}
                      className={`h-12 rounded-md border transition-all hover-elevate active-elevate-2 ${
                        sessionDuration === duration
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-card-border text-foreground"
                      }`}
                      data-testid={`button-duration-${duration}`}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(6)}
              data-testid="button-continue-sport-schedule"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 5 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                1RM-värden (valfritt)
              </h1>
              <p className="text-muted-foreground text-sm">
                Ange dina one-rep max för bättre viktförslag under träning
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Bänkpress (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmBench || ""}
                  onChange={(e) => setOneRmBench(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-bench"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Axelpress (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmOhp || ""}
                  onChange={(e) => setOneRmOhp(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-ohp"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Marklyft (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmDeadlift || ""}
                  onChange={(e) => setOneRmDeadlift(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-deadlift"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Knäböj (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmSquat || ""}
                  onChange={(e) => setOneRmSquat(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-squat"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Latsdrag (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmLatpull || ""}
                  onChange={(e) => setOneRmLatpull(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-latpull"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic">
              💡 Vet du inte ditt 1RM? Lämna tomt så får du AI-baserade förslag istället.
            </p>

            {generationLimit && (
              <div className="text-center text-sm text-muted-foreground mb-2">
                Genereringar kvar denna vecka: {generationLimit.remaining}/{generationLimit.total}
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || (generationLimit && !generationLimit.allowed)}
              data-testid="button-generate-programs"
            >
              {updateMutation.isPending ? <LoadingAnimation /> : "Generera nya pass"}
            </Button>
            
            {generationLimit && !generationLimit.allowed && generationLimit.resetDate && (
              <p className="text-destructive text-sm text-center mt-2">
                Du har nått gränsen för denna vecka. Återställs: {new Date(generationLimit.resetDate).toLocaleDateString('sv-SE')}
              </p>
            )}
          </div>
        )}

        {step === 6 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                1RM-värden (valfritt)
              </h1>
              <p className="text-muted-foreground text-sm">
                Ange dina one-rep max för bättre viktförslag under träning
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Bänkpress (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmBench || ""}
                  onChange={(e) => setOneRmBench(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-bench"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Axelpress (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmOhp || ""}
                  onChange={(e) => setOneRmOhp(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-ohp"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Marklyft (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmDeadlift || ""}
                  onChange={(e) => setOneRmDeadlift(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-deadlift"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Knäböj (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmSquat || ""}
                  onChange={(e) => setOneRmSquat(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-squat"
                />
              </div>

              <div className="space-y-2">
                <label className="text-foreground font-medium text-sm">
                  Latsdrag (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oneRmLatpull || ""}
                  onChange={(e) => setOneRmLatpull(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 px-4 text-foreground bg-card border border-card-border rounded-md"
                  data-testid="input-1rm-latpull"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic">
              💡 Vet du inte ditt 1RM? Lämna tomt så får du AI-baserade förslag istället.
            </p>

            {generationLimit && (
              <div className="text-center text-sm text-muted-foreground mb-2">
                Genereringar kvar denna vecka: {generationLimit.remaining}/{generationLimit.total}
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || (generationLimit && !generationLimit.allowed)}
              data-testid="button-generate-programs"
            >
              {updateMutation.isPending ? <LoadingAnimation /> : "Generera nya pass"}
            </Button>
            
            {generationLimit && !generationLimit.allowed && generationLimit.resetDate && (
              <p className="text-destructive text-sm text-center mt-2">
                Du har nått gränsen för denna vecka. Återställs: {new Date(generationLimit.resetDate).toLocaleDateString('sv-SE')}
              </p>
            )}
          </div>
        )}
      </div>

      {isGenerating && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95"
          data-testid="program-building-overlay"
        >
          <ProgramBuildingAnimation />
        </div>
      )}
    </div>
  );
}
