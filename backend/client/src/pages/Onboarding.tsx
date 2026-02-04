import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Heart, Flame, Activity, TrendingUp, Lock, Check, Scan, Sparkles, Grid3x3, Palette, User, Smartphone, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EquipmentScanner } from "@/components/EquipmentScanner";
import { equipmentOptions } from "@shared/equipment-mapping";
import ThemeSelector from "@/components/ThemeSelector";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import ProgramBuildingAnimation from "@/components/ProgramBuildingAnimation";
import { useVitalLink } from "@tryvital/vital-link";
import { Logo } from "@/components/Logo";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [generationCancelled, setGenerationCancelled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [motivationType, setMotivationType] = useState<string>("");
  const [specificSport, setSpecificSport] = useState<string>("");
  const [trainingLevel, setTrainingLevel] = useState<string>("");
  const [healthConnected, setHealthConnected] = useState(false);
  const [vitalLinkToken, setVitalLinkToken] = useState<string | null>(null);
  const [fetchingBodyData, setFetchingBodyData] = useState(false);
  
  // Personal info
  const [age, setAge] = useState<number | undefined>();
  const [sex, setSex] = useState<string>("");
  const [bodyWeight, setBodyWeight] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [dataSource, setDataSource] = useState<{
    weight?: 'vital' | 'manual';
    height?: 'vital' | 'manual';
    age?: 'vital' | 'manual';
  }>({});
  
  const [goalStrength, setGoalStrength] = useState(25);
  const [goalVolume, setGoalVolume] = useState(25);
  const [goalEndurance, setGoalEndurance] = useState(25);
  const [goalCardio, setGoalCardio] = useState(25);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [oneRmBench, setOneRmBench] = useState<number | undefined>();
  const [oneRmOhp, setOneRmOhp] = useState<number | undefined>();
  const [oneRmDeadlift, setOneRmDeadlift] = useState<number | undefined>();
  const [oneRmSquat, setOneRmSquat] = useState<number | undefined>();
  const [oneRmLatpull, setOneRmLatpull] = useState<number | undefined>();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const totalSteps = motivationType === "sport" ? 10 : 9;
  const progressPercentage = (step / totalSteps) * 100;

  // Fetch body data from Vital API after connection
  const fetchBodyData = useCallback(async () => {
    setFetchingBodyData(true);
    try {
      const response = await fetch('/api/health/body-data');
      if (!response.ok) {
        throw new Error('Failed to fetch body data');
      }
      
      const data = await response.json();
      let dataFetched = false;
      
      if (data.weight) {
        setBodyWeight(Math.round(data.weight));
        setDataSource(prev => ({ ...prev, weight: 'vital' }));
        dataFetched = true;
      }
      if (data.height) {
        setHeight(Math.round(data.height));
        setDataSource(prev => ({ ...prev, height: 'vital' }));
        dataFetched = true;
      }
      if (data.birthdate) {
        const birthDate = new Date(data.birthdate);
        const today = new Date();
        const calculatedAge = today.getFullYear() - birthDate.getFullYear();
        setAge(calculatedAge);
        setDataSource(prev => ({ ...prev, age: 'vital' }));
        dataFetched = true;
      }
      
      if (dataFetched) {
        toast({
          title: "Hälsodata hämtad!",
          description: "Dina värden har automatiskt fyllts i från din anslutna enhet.",
        });
      } else {
        toast({
          title: "Ingen data tillgänglig",
          description: "Din enhet har ingen vikt/längd-data ännu. Fyll i värdena manuellt.",
        });
      }
    } catch (error) {
      console.error('Failed to fetch body data:', error);
      toast({
        title: "Kunde inte hämta data",
        description: "Fyll i dina värden manuellt i nästa steg.",
        variant: "destructive",
      });
    } finally {
      setFetchingBodyData(false);
    }
  }, [toast]);

  // Vital Link Widget callbacks
  const onVitalSuccess = useCallback(async (metadata: any) => {
    console.log('[VITAL] Connection successful:', metadata);
    setHealthConnected(true);
    
    toast({
      title: "Ansluten!",
      description: "Din hälsodata är nu ansluten. Hämtar dina värden...",
    });
    
    // Fetch body data after successful connection
    await fetchBodyData();
    
    // Move to next step automatically
    setTimeout(() => {
      if (motivationType === "sport") {
        setStep(5); // Personal info for sport
      } else {
        setStep(4); // Personal info for non-sport
      }
    }, 1000);
  }, [motivationType, toast, fetchBodyData]);

  const onVitalExit = useCallback((metadata: any) => {
    console.log('[VITAL] User exited widget:', metadata);
  }, []);

  const onVitalError = useCallback((metadata: any) => {
    console.error('[VITAL] Connection error:', metadata);
    toast({
      title: "Anslutning misslyckades",
      description: "Kunde inte ansluta din hälsodata. Försök igen eller hoppa över.",
      variant: "destructive",
    });
  }, [toast]);

  // Configure Vital Link Widget
  const vitalConfig = {
    onSuccess: onVitalSuccess,
    onExit: onVitalExit,
    onError: onVitalError,
    env: (import.meta.env.VITE_VITAL_ENVIRONMENT || "sandbox") as "sandbox" | "production",
  };

  const { open: openVitalLink, ready: vitalReady, error: vitalError } = useVitalLink(vitalConfig);

  // Function to initiate Vital connection
  const handleConnectHealth = async () => {
    try {
      const res = await apiRequest('POST', '/api/health/connect');
      const response = await res.json();
      
      if (response.success && response.linkToken) {
        setVitalLinkToken(response.linkToken);
        // Open Vital Link Widget
        openVitalLink(response.linkToken);
      } else {
        throw new Error('Failed to generate link token');
      }
    } catch (error) {
      console.error('Failed to connect health:', error);
      toast({
        title: "Anslutning misslyckades",
        description: "Kunde inte starta anslutningen. Försök igen.",
        variant: "destructive",
      });
    }
  };

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

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Reset cancelled flag for new generation attempt
      setGenerationCancelled(false);
      
      if (!motivationType || !trainingLevel || sessionsPerWeek < 1 || sessionsPerWeek > 7 || sessionDuration < 15) {
        throw new Error("Please complete all required fields correctly");
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      const profile: any = {
        motivationType,
        trainingLevel,
        theme,
        goalStrength: Math.max(0, Math.min(100, goalStrength)),
        goalVolume: Math.max(0, Math.min(100, goalVolume)),
        goalEndurance: Math.max(0, Math.min(100, goalEndurance)),
        goalCardio: Math.max(0, Math.min(100, goalCardio)),
        sessionsPerWeek: Math.max(1, Math.min(7, sessionsPerWeek)),
        sessionDuration: Math.max(15, Math.min(180, sessionDuration)),
        restTime: 60,
        onboardingCompleted: true,
        appleHealthConnected: false, // Apple Health requires iOS SDK, not available in PWA
        equipmentRegistered: selectedEquipment.length > 0,
      };

      if (motivationType === "sport" && specificSport) {
        profile.specificSport = specificSport;
      } else {
        // Explicitly clear sport when motivation type is not "sport"
        profile.specificSport = null;
      }

      if (age) profile.age = age;
      if (sex) profile.sex = sex;
      if (bodyWeight) profile.bodyWeight = bodyWeight;
      if (height) profile.height = height;

      if (oneRmBench) profile.oneRmBench = oneRmBench;
      if (oneRmOhp) profile.oneRmOhp = oneRmOhp;
      if (oneRmDeadlift) profile.oneRmDeadlift = oneRmDeadlift;
      if (oneRmSquat) profile.oneRmSquat = oneRmSquat;
      if (oneRmLatpull) profile.oneRmLatpull = oneRmLatpull;

      const payload = {
        profile,
        equipment: selectedEquipment,
      };

      return await apiRequest("POST", "/api/onboarding/complete", payload, abortControllerRef.current.signal);
    },
    onSuccess: () => {
      setGenerationCancelled(false); // Reset flag on success
      // Invalidate profile cache so Dashboard picks up the new profile with correct sessionsPerWeek
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/program/templates'] });
      toast({
        title: "Profile created",
        description: "Your training profile has been set up successfully",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      // Check if error is from manual abort (don't show error toast for user cancellation)
      const isAbortError = error?.name === 'AbortError' || error?.message?.includes('abort');
      
      if (!isAbortError) {
        toast({
          title: "Error",
          description: error.message || "Failed to complete setup",
          variant: "destructive",
        });
      }
      
      // After error, allow user to retry or continue
      setGenerationCancelled(true);
    },
  });

  const handleCancelGeneration = () => {
    // Abort the in-flight HTTP request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Reset mutation state
    completeMutation.reset();
    setGenerationCancelled(true);
    
    toast({
      title: "Generering avbruten",
      description: "Du kan alltid generera ett nytt program senare från Dashboard",
    });
    
    // Navigate to dashboard
    setLocation("/");
  };

  // Add 5-minute frontend timeout
  useEffect(() => {
    if (!completeMutation.isPending) {
      return;
    }

    // Set a 5-minute (300000ms) timeout
    const maxTimeout = setTimeout(() => {
      // Abort the in-flight HTTP request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      completeMutation.reset();
      setGenerationCancelled(true);
      
      toast({
        title: "Timeout",
        description: "Programgenereringen tog för lång tid. Försök igen senare från Dashboard.",
        variant: "destructive",
      });
      
      setLocation("/");
    }, 300000);

    return () => {
      clearTimeout(maxTimeout);
    };
  }, [completeMutation.isPending]);

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipment)
        ? prev.filter((e) => e !== equipment)
        : [...prev, equipment]
    );
  };

  const handleEquipmentDetected = (detectedEquipment: string[]) => {
    const newEquipment = detectedEquipment.filter(eq => !selectedEquipment.includes(eq));
    if (newEquipment.length > 0) {
      setSelectedEquipment((prev) => [...prev, ...newEquipment]);
      toast({
        title: "Equipment Added",
        description: `Added ${newEquipment.length} new item(s)`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {completeMutation.isPending && !generationCancelled && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <ProgramBuildingAnimation onCancel={handleCancelGeneration} />
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          {step > 1 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setStep(step - 1)}
              className="rounded-full"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex-1 h-1 bg-muted rounded-full overflow-visible">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-12 space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                  <Logo 
                    variant="icon" 
                    theme="main"
                    className="w-12 h-12"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-1">
                  RepCompanion
                </h1>
                <p className="text-sm text-muted-foreground">
                  Din AI-drivna träningspartner
                </p>
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Vad motiverar dig att träna?
              </h2>
              <p className="text-muted-foreground">
                Välj ditt primära träningsmål
              </p>
            </div>

            <div className="space-y-4">
              {[
                { value: "fitness", title: "Fitness", desc: "Komma i form och må bättre" },
                { value: "viktminskning", title: "Viktminskning", desc: "Gå ner i vikt och förbättra hälsan" },
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
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Heart className="w-10 h-10 text-primary" />
                <Smartphone className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Synka Hälsodata
              </h1>
              <p className="text-muted-foreground">
                Anslut din hälsodata från wearables och fitness-appar
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-foreground">
                RepCompanion kan synkronisera med följande tjänster:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {["Fitbit", "Oura", "Google Fit", "Garmin", "WHOOP", "Samsung Health"].map((provider) => (
                  <div key={provider} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground">{provider}</span>
                  </div>
                ))}
              </div>

              <Card className="p-4 bg-orange-500/10 border-orange-500/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Apple Health
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Apple Health kräver en iOS-app och är inte tillgänglig i PWA-versionen. Använd en av de andra tjänsterna ovan för att synka din hälsodata.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="pt-2 space-y-3">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleConnectHealth}
                  disabled={!vitalReady}
                  data-testid="button-connect-health"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  Anslut Hälsodata
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-12 text-base font-semibold"
                  onClick={() => setStep(4)}
                  data-testid="button-skip-health"
                >
                  Hoppa över
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">👤</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Personlig information
              </h1>
              <p className="text-muted-foreground">
                Hjälper oss att skräddarsy ditt träningsprogram
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="age" className="text-foreground">Ålder *</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="T.ex. 35"
                  value={age || ""}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="15"
                  max="100"
                  data-testid="input-age"
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Kön *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Card
                    className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                      sex === "man" ? "border-primary border-2" : ""
                    }`}
                    onClick={() => setSex("man")}
                    data-testid="option-sex-man"
                  >
                    <p className="font-medium text-foreground text-center">Man</p>
                  </Card>
                  <Card
                    className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                      sex === "kvinna" ? "border-primary border-2" : ""
                    }`}
                    onClick={() => setSex("kvinna")}
                    data-testid="option-sex-kvinna"
                  >
                    <p className="font-medium text-foreground text-center">Kvinna</p>
                  </Card>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight" className="text-foreground">Vikt (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="T.ex. 75"
                  value={bodyWeight || ""}
                  onChange={(e) => setBodyWeight(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="30"
                  max="250"
                  data-testid="input-weight"
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height" className="text-foreground">Längd (cm) *</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="T.ex. 175"
                  value={height || ""}
                  onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="120"
                  max="250"
                  data-testid="input-height"
                  className="text-base"
                />
              </div>

              {age && bodyWeight && height && (
                <Card className="p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    BMI: <span className="font-semibold text-foreground">
                      {(bodyWeight / Math.pow(height / 100, 2)).toFixed(1)}
                    </span>
                  </p>
                </Card>
              )}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(5)}
              disabled={!age || !sex || !bodyWeight || !height}
              data-testid="button-continue-personal-info"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 4 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Heart className="w-10 h-10 text-primary" />
                <Smartphone className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Synka Hälsodata
              </h1>
              <p className="text-muted-foreground">
                Anslut din hälsodata från wearables och fitness-appar
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-foreground">
                RepCompanion kan synkronisera med följande tjänster:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {["Fitbit", "Oura", "Google Fit", "Garmin", "WHOOP", "Samsung Health"].map((provider) => (
                  <div key={provider} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground">{provider}</span>
                  </div>
                ))}
              </div>

              <Card className="p-4 bg-orange-500/10 border-orange-500/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Apple Health
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Apple Health kräver en iOS-app och är inte tillgänglig i PWA-versionen. Använd en av de andra tjänsterna ovan för att synka din hälsodata.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="pt-2 space-y-3">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleConnectHealth}
                  disabled={!vitalReady}
                  data-testid="button-connect-health"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  Anslut Hälsodata
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-12 text-base font-semibold"
                  onClick={() => setStep(5)}
                  data-testid="button-skip-health"
                >
                  Hoppa över
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">👤</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Personlig information
              </h1>
              <p className="text-muted-foreground">
                Hjälper oss att skräddarsy ditt träningsprogram
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="age-sport" className="text-foreground">Ålder *</Label>
                <Input
                  id="age-sport"
                  type="number"
                  placeholder="T.ex. 35"
                  value={age || ""}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="15"
                  max="100"
                  data-testid="input-age-sport"
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Kön *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Card
                    className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                      sex === "man" ? "border-primary border-2" : ""
                    }`}
                    onClick={() => setSex("man")}
                    data-testid="option-sex-man-sport"
                  >
                    <p className="font-medium text-foreground text-center">Man</p>
                  </Card>
                  <Card
                    className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                      sex === "kvinna" ? "border-primary border-2" : ""
                    }`}
                    onClick={() => setSex("kvinna")}
                    data-testid="option-sex-kvinna-sport"
                  >
                    <p className="font-medium text-foreground text-center">Kvinna</p>
                  </Card>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight-sport" className="text-foreground">Vikt (kg) *</Label>
                <Input
                  id="weight-sport"
                  type="number"
                  placeholder="T.ex. 75"
                  value={bodyWeight || ""}
                  onChange={(e) => setBodyWeight(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="30"
                  max="250"
                  data-testid="input-weight-sport"
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height-sport" className="text-foreground">Längd (cm) *</Label>
                <Input
                  id="height-sport"
                  type="number"
                  placeholder="T.ex. 175"
                  value={height || ""}
                  onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="120"
                  max="250"
                  data-testid="input-height-sport"
                  className="text-base"
                />
              </div>

              {age && bodyWeight && height && (
                <Card className="p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    BMI: <span className="font-semibold text-foreground">
                      {(bodyWeight / Math.pow(height / 100, 2)).toFixed(1)}
                    </span>
                  </p>
                </Card>
              )}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(6)}
              disabled={!age || !sex || !bodyWeight || !height}
              data-testid="button-continue-personal-info-sport"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 5 && motivationType !== "sport" && (
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
                  <label className="text-foreground font-medium">
                    Strength
                  </label>
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
                  <label className="text-foreground font-medium">Volume</label>
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
                  <label className="text-foreground font-medium">
                    Endurance
                  </label>
                  <span className="text-muted-foreground">
                    {goalEndurance}%
                  </span>
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
                  <label className="text-foreground font-medium">Cardio</label>
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
              onClick={() => setStep(6)}
              data-testid="button-continue-goals"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 6 && motivationType === "sport" && (
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
              onClick={() => setStep(7)}
              data-testid="button-continue-sport-goals"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 6 && motivationType !== "sport" && (
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
              onClick={() => setStep(8)}
              data-testid="button-continue-schedule"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 7 && motivationType === "sport" && (
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
              onClick={() => setStep(9)}
              data-testid="button-continue-sport-schedule"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 8 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Välj ditt tema
                  </h1>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Anpassa appens utseende med ditt favoritfärgschema
              </p>
            </div>

            <Card className="p-6">
              <ThemeSelector />
            </Card>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(9)}
              data-testid="button-continue-theme"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 9 && motivationType !== "sport" && (
          <div className="space-y-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Tillgänglig utrustning
              </h1>
              <p className="text-muted-foreground text-sm">
                Skanna utrustning med kamera eller välj manuellt
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Recommended Method</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Use AI to automatically recognize equipment by taking a photo
                </p>
                <Button
                  onClick={() => setScannerOpen(true)}
                  className="w-full h-12 text-base font-semibold"
                  data-testid="button-scan-equipment"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  Scan with Camera
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Or select manually</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Browse all equipment</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {equipmentOptions.map((equipment) => (
                    <button
                      key={equipment}
                      onClick={() => toggleEquipment(equipment)}
                      className={`p-4 rounded-lg border text-left transition-all hover-elevate active-elevate-2 relative ${
                        selectedEquipment.includes(equipment)
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-card-border"
                      }`}
                      data-testid={`equipment-${equipment.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span className="text-foreground font-medium text-sm">
                        {equipment}
                      </span>
                      {selectedEquipment.includes(equipment) && (
                        <Check className="w-4 h-4 text-primary absolute top-2 right-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              data-testid="button-complete-onboarding"
            >
              Slutför
            </Button>
          </div>
        )}

        {step === 9 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Välj ditt tema
                  </h1>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Anpassa appens utseende med ditt favoritfärgschema
              </p>
            </div>

            <Card className="p-6">
              <ThemeSelector />
            </Card>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => setStep(10)}
              data-testid="button-continue-theme"
            >
              Fortsätt
            </Button>
          </div>
        )}

        {step === 10 && motivationType === "sport" && (
          <div className="space-y-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Tillgänglig utrustning
              </h1>
              <p className="text-muted-foreground text-sm">
                Skanna utrustning med kamera eller välj manuellt
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Rekommenderad metod</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Använd AI för att automatiskt känna igen utrustning genom att ta ett foto
                </p>
                <Button
                  onClick={() => setScannerOpen(true)}
                  className="w-full h-12 text-base font-semibold"
                  data-testid="button-scan-equipment"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  Skanna med kamera
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Eller välj manuellt</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Bläddra bland all utrustning</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {equipmentOptions.map((equipment) => (
                    <button
                      key={equipment}
                      onClick={() => toggleEquipment(equipment)}
                      className={`p-4 rounded-lg border text-left transition-all hover-elevate active-elevate-2 relative ${
                        selectedEquipment.includes(equipment)
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-card-border"
                      }`}
                      data-testid={`equipment-${equipment.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span className="text-foreground font-medium text-sm">
                        {equipment}
                      </span>
                      {selectedEquipment.includes(equipment) && (
                        <Check className="w-4 h-4 text-primary absolute top-2 right-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              data-testid="button-complete-onboarding"
            >
              Slutför
            </Button>
          </div>
        )}
      </div>

      <EquipmentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onEquipmentDetected={handleEquipmentDetected}
      />
    </div>
  );
}
