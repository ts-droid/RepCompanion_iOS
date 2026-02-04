import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Save, User, Target, Clock, Activity, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.workout.getProfile.useQuery(
    undefined,
    { enabled: !!user }
  );
  const updateProfileMutation = trpc.workout.updateProfile.useMutation();

  // Basic info
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<"male" | "female" | "other">("male");
  const [bodyWeight, setBodyWeight] = useState(80);
  const [height, setHeight] = useState(180);
  const [bodyFatPercent, setBodyFatPercent] = useState(15);
  const [muscleMassPercent, setMuscleMassPercent] = useState(40);

  // 1RM values
  const [oneRmBench, setOneRmBench] = useState(80);
  const [oneRmOhp, setOneRmOhp] = useState(60);
  const [oneRmDeadlift, setOneRmDeadlift] = useState(120);
  const [oneRmLatpull, setOneRmLatpull] = useState(70);

  // Training settings
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [goalVolume, setGoalVolume] = useState(50);
  const [goalStrength, setGoalStrength] = useState(30);
  const [goalCardio, setGoalCardio] = useState(20);
  const [restTime, setRestTime] = useState(60);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiProgram, setAiProgram] = useState<any>(null);

  const generateProgramMutation = trpc.ai.generateWorkoutProgram.useMutation();

  // Load profile data
  useEffect(() => {
    if (profile) {
      if (profile.age) setAge(profile.age);
      if (profile.sex) setSex(profile.sex as "male" | "female" | "other");
      if (profile.bodyWeight) setBodyWeight(profile.bodyWeight);
      if (profile.height) setHeight(profile.height);
      if (profile.bodyFatPercent) setBodyFatPercent(profile.bodyFatPercent);
      if (profile.muscleMassPercent) setMuscleMassPercent(profile.muscleMassPercent);
      if (profile.oneRmBench) setOneRmBench(profile.oneRmBench);
      if (profile.oneRmOhp) setOneRmOhp(profile.oneRmOhp);
      if (profile.oneRmDeadlift) setOneRmDeadlift(profile.oneRmDeadlift);
      if (profile.oneRmLatpull) setOneRmLatpull(profile.oneRmLatpull);
      if (profile.sessionsPerWeek) setSessionsPerWeek(profile.sessionsPerWeek);
      if (profile.sessionDuration) setSessionDuration(profile.sessionDuration);
      if (profile.goalVolume) setGoalVolume(profile.goalVolume);
      if (profile.goalStrength) setGoalStrength(profile.goalStrength);
      if (profile.goalCardio) setGoalCardio(profile.goalCardio);
      if (profile.restTime) setRestTime(profile.restTime);
    }
  }, [profile]);

  // Calculate BMI
  const calculateBMI = (): number => {
    if (!bodyWeight || !height) return 0;
    const heightInMeters = height / 100;
    return bodyWeight / (heightInMeters * heightInMeters);
  };

  const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return "Undervikt";
    if (bmi < 25) return "Normalvikt";
    if (bmi < 30) return "Övervikt";
    return "Fetma";
  };

  const handleGenerateProgram = () => {
    generateProgramMutation.mutate(
      {
        age,
        sex,
        bodyWeight,
        height,
        bodyFatPercent,
        muscleMassPercent,
        sessionsPerWeek,
        sessionDuration,
        goalVolume,
        goalStrength,
        goalCardio,
        oneRmBench,
        oneRmOhp,
        oneRmDeadlift,
        oneRmLatpull,
      },
      {
        onSuccess: (data) => {
          setAiProgram(data.program);
          setShowAIDialog(true);
          toast.success("Träningsprogram genererat!");
        },
        onError: (error) => {
          toast.error("Kunde inte generera program: " + error.message);
        },
      }
    );
  };

  const handleSave = () => {
    updateProfileMutation.mutate(
      {
        age,
        sex,
        bodyWeight,
        height,
        bodyFatPercent,
        muscleMassPercent,
        oneRmBench,
        oneRmOhp,
        oneRmDeadlift,
        oneRmLatpull,
        sessionsPerWeek,
        sessionDuration,
        goalVolume,
        goalStrength,
        goalCardio,
        restTime,
      },
      {
        onSuccess: () => {
          toast.success("Profil sparad!");
        },
        onError: (error) => {
          toast.error("Kunde inte spara profil: " + error.message);
        },
      }
    );
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Logga in</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Du måste logga in för att hantera din profil.
            </p>
            <Button onClick={() => window.location.href = "/api/oauth/login"} className="w-full">
              Logga in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bmi = calculateBMI();
  const bmiCategory = getBMICategory(bmi);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Min Profil</h1>
            <p className="text-muted-foreground">
              Hantera dina personliga inställningar och träningsmål
            </p>
          </div>
          <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Spara
          </Button>
        </div>

        {/* User info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Användarinformation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Inloggad som</p>
              <p className="font-medium">{user.name || user.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>Grundläggande information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ålder</Label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label>Kön</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "male" | "female" | "other")}
                >
                  <option value="male">Man</option>
                  <option value="female">Kvinna</option>
                  <option value="other">Annat</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Vikt (kg)</Label>
                <Input
                  type="number"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(Number(e.target.value))}
                  placeholder="80"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Längd (cm)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  placeholder="180"
                />
              </div>
              <div className="space-y-2">
                <Label>Kroppsfett (%)</Label>
                <Input
                  type="number"
                  value={bodyFatPercent}
                  onChange={(e) => setBodyFatPercent(Number(e.target.value))}
                  placeholder="15"
                />
              </div>
              <div className="space-y-2">
                <Label>Muskelmassa (%)</Label>
                <Input
                  type="number"
                  value={muscleMassPercent}
                  onChange={(e) => setMuscleMassPercent(Number(e.target.value))}
                  placeholder="40"
                />
              </div>
            </div>

            {/* BMI Display */}
            {bmi > 0 && (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">BMI</p>
                    <p className="text-2xl font-bold">{bmi.toFixed(1)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Kategori</p>
                    <p className="text-lg font-semibold">{bmiCategory}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 1RM Values */}
        <Card>
          <CardHeader>
            <CardTitle>1RM-värden</CardTitle>
            <p className="text-sm text-muted-foreground">
              Dina maxvikter för viktrekommendationer
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bänkpress (kg)</Label>
                <Input
                  type="number"
                  value={oneRmBench}
                  onChange={(e) => setOneRmBench(Number(e.target.value))}
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label>Militärpress (kg)</Label>
                <Input
                  type="number"
                  value={oneRmOhp}
                  onChange={(e) => setOneRmOhp(Number(e.target.value))}
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label>Marklyft (kg)</Label>
                <Input
                  type="number"
                  value={oneRmDeadlift}
                  onChange={(e) => setOneRmDeadlift(Number(e.target.value))}
                  placeholder="120"
                />
              </div>
              <div className="space-y-2">
                <Label>Latdrag (kg)</Label>
                <Input
                  type="number"
                  value={oneRmLatpull}
                  onChange={(e) => setOneRmLatpull(Number(e.target.value))}
                  placeholder="70"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Träningsinställningar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Antal pass per vecka</Label>
                  <span className="text-sm font-medium">{sessionsPerWeek} pass</span>
                </div>
                <Slider
                  value={[sessionsPerWeek]}
                  onValueChange={(v) => setSessionsPerWeek(v[0])}
                  min={1}
                  max={7}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Passlängd (minuter)</Label>
                  <span className="text-sm font-medium">{sessionDuration} min</span>
                </div>
                <Slider
                  value={[sessionDuration]}
                  onValueChange={(v) => setSessionDuration(v[0])}
                  min={15}
                  max={120}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Goals */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <CardTitle>Träningsmål</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Fördela dina träningsmål (totalt behöver inte bli 100%)
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Volym (muskeltillväxt)</Label>
                <span className="text-sm font-medium">{goalVolume}%</span>
              </div>
              <Slider
                value={[goalVolume]}
                onValueChange={(v) => setGoalVolume(v[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Styrka</Label>
                <span className="text-sm font-medium">{goalStrength}%</span>
              </div>
              <Slider
                value={[goalStrength]}
                onValueChange={(v) => setGoalStrength(v[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kondition</Label>
                <span className="text-sm font-medium">{goalCardio}%</span>
              </div>
              <Slider
                value={[goalCardio]}
                onValueChange={(v) => setGoalCardio(v[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Rest Time */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Vilotid mellan set</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Nedräkningstimer startar automatiskt efter varje set
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[30, 60, 90, 120].map((time) => (
                <Button
                  key={time}
                  variant={restTime === time ? "default" : "outline"}
                  onClick={() => setRestTime(time)}
                  className="h-16"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold">{time}</div>
                    <div className="text-xs">sekunder</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Program Generation */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI-genererat träningsprogram</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Låt AI skapa ett skräddarsytt träningsprogram baserat på dina inställningar
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateProgram}
              size="lg"
              className="w-full"
              disabled={generateProgramMutation.isPending}
            >
              {generateProgramMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Genererar program...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generera träningsprogram med AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Save button at bottom */}
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Spara alla ändringar
          </Button>
        </div>
      </div>

      {/* AI Program Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-genererat träningsprogram
            </DialogTitle>
            <DialogDescription>
              Baserat på dina personliga mål och förutsättningar
            </DialogDescription>
          </DialogHeader>

          {aiProgram && (
            <div className="space-y-6 mt-4">
              <div>
                <h3 className="text-2xl font-bold">{aiProgram.programName}</h3>
                <p className="text-muted-foreground mt-1">{aiProgram.description}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Programlängd: {aiProgram.duration}
                </p>
              </div>

              {aiProgram.sessions && aiProgram.sessions.map((session: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle>{session.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{session.blurb}</p>
                    {session.estMinutes && (
                      <Badge variant="secondary">{session.estMinutes}</Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Övningar:</Label>
                      {session.exercises && session.exercises.map((ex: any, exIdx: number) => (
                        <div key={exIdx} className="p-3 bg-secondary/30 rounded-lg">
                          <div className="font-medium">{ex.title}</div>
                          <div className="text-sm text-muted-foreground">{ex.prescription}</div>
                          {ex.notes && (
                            <div className="text-xs text-muted-foreground mt-1">{ex.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {aiProgram.nutritionTips && (
                <Card>
                  <CardHeader>
                    <CardTitle>Näringsråd</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{aiProgram.nutritionTips}</p>
                  </CardContent>
                </Card>
              )}

              {aiProgram.progressionPlan && (
                <Card>
                  <CardHeader>
                    <CardTitle>Progressionsplan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{aiProgram.progressionPlan}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3">
                <Button onClick={() => setShowAIDialog(false)} variant="outline" className="flex-1">
                  Stäng
                </Button>
                <Button
                  onClick={() => {
                    toast.success("Programmet har sparats! (Funktion kommer snart)");
                    setShowAIDialog(false);
                  }}
                  className="flex-1"
                >
                  Spara program
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
