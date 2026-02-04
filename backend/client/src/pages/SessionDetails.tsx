import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, Dumbbell } from "lucide-react";
import type { WorkoutSession, ExerciseLog } from "@shared/schema";
import { formatExerciseWeight } from "@/lib/utils";

interface SessionDetailsResponse {
  session: WorkoutSession;
  exerciseLogs: ExerciseLog[];
}

interface GroupedExercise {
  exerciseKey: string;
  exerciseTitle: string;
  exerciseOrderIndex: number;
  sets: ExerciseLog[];
}

export default function SessionDetails() {
  const { sessionId } = useParams();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<SessionDetailsResponse>({
    queryKey: [`/api/sessions/${sessionId}/details`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Laddar pass...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">
              {error ? "Kunde inte ladda passet. Försök igen." : "Passet kunde inte hittas"}
            </p>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
              data-testid="button-back-home"
            >
              Tillbaka till start
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session, exerciseLogs } = data;

  const groupedExercises: GroupedExercise[] = exerciseLogs.reduce((acc, log) => {
    const existing = acc.find(ex => ex.exerciseKey === log.exerciseKey);
    if (existing) {
      existing.sets.push(log);
    } else {
      acc.push({
        exerciseKey: log.exerciseKey,
        exerciseTitle: log.exerciseTitle,
        exerciseOrderIndex: log.exerciseOrderIndex,
        sets: [log],
      });
    }
    return acc;
  }, [] as GroupedExercise[]);

  groupedExercises.sort((a, b) => a.exerciseOrderIndex - b.exerciseOrderIndex);

  const sessionDate = new Date(session.startedAt);
  const formattedDate = sessionDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = sessionDate.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let duration = "";
  if (session.completedAt) {
    const durationMs = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`;
  }

  const totalVolume = exerciseLogs.reduce((sum, log) => {
    if (log.weight && log.reps && log.completed) {
      return sum + (log.weight * log.reps);
    }
    return sum;
  }, 0);

  const totalSets = exerciseLogs.filter(log => log.completed).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        <Button
          onClick={() => navigate("/")}
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka
        </Button>

        <Card data-testid="card-session-header">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{session.sessionName}</CardTitle>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formattedTime}</span>
                  </div>
                  {duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{duration}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-3">
                {session.status === 'completed' ? (
                  <Badge variant="default" className="gap-1" data-testid="badge-status-completed">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Färdigt</span>
                  </Badge>
                ) : session.status === 'cancelled' ? (
                  <Badge variant="destructive" className="gap-1" data-testid="badge-status-cancelled">
                    <XCircle className="w-3 h-3" />
                    <span>Avbrutet</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1" data-testid="badge-status-pending">
                    <span>Pågående</span>
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {session.notes && (
          <Card data-testid="card-notes">
            <CardHeader>
              <CardTitle className="text-base">Anteckningar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-notes">
                {session.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {totalSets > 0 && (
          <Card data-testid="card-statistics">
            <CardHeader>
              <CardTitle className="text-base">Statistik</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-sets">
                    {totalSets}
                  </p>
                  <p className="text-xs text-muted-foreground">Sets</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-exercises">
                    {groupedExercises.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Övningar</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-volume">
                    {totalVolume.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">kg volym</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground px-1">Övningar</h2>
          
          {groupedExercises.length > 0 ? (
            groupedExercises.map((exercise, idx) => (
              <Card key={exercise.exerciseKey} data-testid={`card-exercise-${idx}`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" />
                    {exercise.exerciseTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {exercise.sets
                      .sort((a, b) => a.setNumber - b.setNumber)
                      .map((set, setIdx) => (
                        <div
                          key={set.id}
                          className={`flex items-center justify-between p-2 rounded-md ${
                            set.completed ? 'bg-muted/50' : 'bg-muted/20'
                          }`}
                          data-testid={`set-${idx}-${setIdx}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-12">
                              Set {set.setNumber}
                            </span>
                            {set.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : (
                              <XCircle className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            {set.weight && (
                              <span className="font-medium text-foreground" data-testid={`text-weight-${idx}-${setIdx}`}>
                                {formatExerciseWeight(set.weight, exercise.exerciseTitle)}
                              </span>
                            )}
                            {set.reps && (
                              <span className="text-muted-foreground" data-testid={`text-reps-${idx}-${setIdx}`}>
                                {set.reps} reps
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card data-testid="card-no-exercises">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-4">
                  Inga övningar registrerade
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
