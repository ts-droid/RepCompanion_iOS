import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Flame, Dumbbell, Calendar, Clock, ArrowLeft } from "lucide-react";
import type { WorkoutSession, ExerciseLog } from "@shared/schema";

interface ExerciseProgressData {
  exercise: string;
  weights: { date: string; weight: number; reps: number }[];
  totalSets: number;
  totalVolume: number;
  avgWeight: number;
  maxWeight: number;
}

interface ProgressStats {
  totalSessions: number;
  totalVolume: number;
  totalExercises: number;
  averageSessionDuration: number;
  weeklySessionsTrend: { week: string; sessions: number }[];
  topExercises: { name: string; volume: number; count: number }[];
  strengthProgress: ExerciseProgressData[];
}

export default function Progress() {
  const [, setLocation] = useLocation();

  const { data: sessions } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: stats, isLoading } = useQuery<ProgressStats>({
    queryKey: ["/api/stats/progress"],
  });

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Laddar statistik...</p>
        </div>
      </div>
    );
  }

  const chartColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="p-4 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Träningsstatistik
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Övervaka din utveckling över tid</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-full mx-auto space-y-6 w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <Card data-testid="card-total-sessions">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Totala Sessioner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stats.totalSessions}</p>
              <p className="text-xs text-muted-foreground mt-1">Genomförda träningspass</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-volume">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Total Volym
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{(stats.totalVolume / 1000).toFixed(1)}k kg</p>
              <p className="text-xs text-muted-foreground mt-1">Lyftat i totalt</p>
            </CardContent>
          </Card>

          <Card data-testid="card-unique-exercises">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Dumbbell className="w-4 h-4" />
                Unika Övningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stats.totalExercises}</p>
              <p className="text-xs text-muted-foreground mt-1">Olika träningsöv</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-duration">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Snitt Pass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stats.averageSessionDuration}m</p>
              <p className="text-xs text-muted-foreground mt-1">Per träningspass</p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Trend Chart */}
        <Card data-testid="card-weekly-trend">
          <CardHeader>
            <CardTitle>Veckovisa Sessioner</CardTitle>
            <CardDescription>Dina träningspass per vecka över tid</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.weeklySessionsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#3b82f6"
                  name="Sessioner"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Exercises */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <Card data-testid="card-top-exercises">
            <CardHeader>
              <CardTitle>Toppövningar</CardTitle>
              <CardDescription>Din mest tränade övning</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.topExercises.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#10b981" name="Volym (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-exercise-distribution">
            <CardHeader>
              <CardTitle>Övningsfördelning</CardTitle>
              <CardDescription>Fördelning av toppövningar</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.topExercises.slice(0, 5)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {stats.topExercises.slice(0, 5).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Strength Progress */}
        {stats.strengthProgress.length > 0 && (
          <Card data-testid="card-strength-progress">
            <CardHeader>
              <CardTitle>Styreutveckling</CardTitle>
              <CardDescription>Viktökning för dina stora lyft</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {stats.strengthProgress.slice(0, 4).map((exercise) => (
                  <div key={exercise.exercise} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-foreground">{exercise.exercise}</h3>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{exercise.maxWeight} kg max</p>
                        <p className="text-xs text-muted-foreground">{exercise.avgWeight.toFixed(1)} kg snitt</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={exercise.weights}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={["dataMin - 5", "dataMax + 5"]} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
