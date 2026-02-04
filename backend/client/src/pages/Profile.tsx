import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Settings, Dumbbell, MapPin, Calendar, Clock, Target, LogOut, Download, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ThemeSelector from "@/components/ThemeSelector";
import HealthConnectButton from "@/components/HealthConnectButton";
import AvatarSelector from "@/components/AvatarSelector";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile, Gym } from "@shared/schema";
import AvatarGenerator from "react-nice-avatar";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: gyms } = useQuery<Gym[]>({
    queryKey: ["/api/gyms"],
  });

  const { data: equipment } = useQuery<any[]>({
    queryKey: ["/api/equipment"],
  });

  useEffect(() => {
    if (!profileLoading && profile && !profile.onboardingCompleted) {
      setLocation("/onboarding");
    }
  }, [profile, profileLoading, setLocation]);


  const handleExportExercises = async () => {
    setIsExporting(true);
    let url: string | null = null;
    
    try {
      const response = await fetch("/api/exercises/export", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export exercises");
      }
      
      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const today = new Date().toISOString().split('T')[0];
      a.download = `repcompanion-ovningar-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Export slutförd",
        description: "Övningarna har laddats ner som CSV-fil",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export misslyckades",
        description: "Kunde inte exportera övningar. Försök igen.",
        variant: "destructive",
      });
    } finally {
      if (url) {
        window.URL.revokeObjectURL(url);
      }
      setIsExporting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!profile?.onboardingCompleted) {
    return null;
  }

  const activeGym = gyms?.find(g => g.id === profile?.selectedGymId);
  const equipmentCount = equipment?.filter(e => e.gymId === activeGym?.id).length || 0;

  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-xl font-bold text-foreground">Profil</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-4xl cursor-pointer hover-elevate bg-primary/10 overflow-hidden"
                    onClick={() => setShowAvatarSelector(true)}
                    data-testid="button-avatar-selector"
                  >
                    {profile?.avatarType === "emoji" && (profile?.avatarEmoji || "💪")}
                    {profile?.avatarType === "image" && profile?.avatarImageUrl && (
                      <img
                        src={profile.avatarImageUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {profile?.avatarType === "generated" && !!profile?.avatarConfig && (
                      <AvatarGenerator
                        style={{ width: "100%", height: "100%" }}
                        {...(profile.avatarConfig as any)}
                      />
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-0 right-0 rounded-full"
                    onClick={() => setShowAvatarSelector(true)}
                    data-testid="button-edit-avatar"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {user?.firstName || user?.email?.split('@')[0] || "Användare"}
                  </h2>
                  <p className="text-muted-foreground text-sm">{user?.email}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Pass/vecka</span>
                </div>
                <p className="text-xl font-bold text-foreground">{profile.sessionsPerWeek}</p>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Min/pass</span>
                </div>
                <p className="text-xl font-bold text-foreground">{profile.sessionDuration}</p>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Ålder</span>
                </div>
                <p className="text-xl font-bold text-foreground">{profile.age || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground">Kön</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {profile.sex === "man" ? "Man" : profile.sex === "kvinna" ? "Kvinna" : profile.sex === "både" ? "Både" : "—"}
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground">Träningsnivå</span>
                </div>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {profile.trainingLevel?.replace(/_/g, " ") || "—"}
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground">Fokus</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {profile.motivationType === "fitness" ? "Fitness" : 
                   profile.motivationType === "viktminskning" ? "Vikt" :
                   profile.motivationType === "rehabilitering" ? "Rehab" :
                   profile.motivationType === "hälsa_livsstil" ? "Hälsa" :
                   profile.motivationType === "sport" ? "Sport" : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Träningsmål
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-foreground">Styrka</span>
                <span className="text-sm text-muted-foreground">{profile.goalStrength}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${profile.goalStrength}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-foreground">Volym</span>
                <span className="text-sm text-muted-foreground">{profile.goalVolume}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${profile.goalVolume}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-foreground">Uthållighet</span>
                <span className="text-sm text-muted-foreground">{profile.goalEndurance}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${profile.goalEndurance}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-foreground">Cardio</span>
                <span className="text-sm text-muted-foreground">{profile.goalCardio}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${profile.goalCardio}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ThemeSelector />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Hälsointegration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Synka automatiskt träningsdata, steg, sömn och återhämtning från dina hälsoplattformar.
              </p>
              <HealthConnectButton variant="default" size="default" className="w-full" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Aktivt Gym
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeGym ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{activeGym.name}</h3>
                    {activeGym.location && (
                      <p className="text-sm text-muted-foreground">{activeGym.location}</p>
                    )}
                  </div>
                  <Badge variant="default">Aktivt</Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">{equipmentCount} utrustning</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inget gym valt</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 pb-20">
          <Button
            className="w-full h-12"
            variant="outline"
            onClick={() => setLocation("/gyms")}
            data-testid="button-manage-gyms"
          >
            <Dumbbell className="w-5 h-5 mr-2" />
            Mina Gym
          </Button>

          <Button
            className="w-full h-12"
            variant="outline"
            onClick={() => setLocation("/adjust-training")}
            data-testid="button-adjust-training"
          >
            <Settings className="w-5 h-5 mr-2" />
            Justera Träning
          </Button>

          <Button
            className="w-full h-12"
            variant="outline"
            onClick={handleExportExercises}
            disabled={isExporting}
            data-testid="button-export-exercises"
          >
            <Download className="w-5 h-5 mr-2" />
            {isExporting ? "Exporterar..." : "Exportera Övningar"}
          </Button>

          <Button
            className="w-full h-12"
            variant="destructive"
            onClick={async () => {
              try {
                await apiRequest("POST", "/api/auth/logout");
                window.location.href = "/";
              } catch (error) {
                console.error("Logout failed:", error);
              }
            }}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logga ut
          </Button>
        </div>
      </div>

      {showAvatarSelector && profile && (
        <AvatarSelector
          profile={profile}
          onClose={() => setShowAvatarSelector(false)}
        />
      )}
    </div>
  );
}
