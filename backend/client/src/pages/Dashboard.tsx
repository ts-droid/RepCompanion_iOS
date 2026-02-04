import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Sparkles, Calendar, Clock, CheckCircle2, XCircle, TrendingUp, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ActivityRecoveryGauges from "@/components/ActivityRecoveryGauges";
import NotificationBanner from "@/components/NotificationBanner";
import ProgramCard from "@/components/ProgramCard";
import BottomNav from "@/components/BottomNav";
import { PromoCard } from "@/components/PromoCard";
import ProgramBuildingAnimation from "@/components/ProgramBuildingAnimation";
import HealthMetricsCard from "@/components/HealthMetricsCard";
import { PersonalizedTipsCard } from "@/components/PersonalizedTipsCard";
import { TipsSection } from "@/components/TipsSection";
import { ResumeSessionDialog } from "@/components/ResumeSessionDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserProfile, WorkoutSession, ProgramTemplate, ProfileTrainingTip } from "@shared/schema";
import { useTrainingTips, getRandomTip, getDismissedTips, dismissTip } from "@/hooks/use-training-tips";
import { getShortDayName } from "@/lib/utils";

export default function Dashboard() {
  // Read tab from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get("tab");
  
  const [activeTab, setActiveTab] = useState(tabFromUrl === "programs" ? "programs" : "home");
  const [showNotification, setShowNotification] = useState(true);
  const [currentTip, setCurrentTip] = useState<ProfileTrainingTip | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleTabChange = (tab: string) => {
    if (tab === "profile") {
      setLocation("/profile");
    } else {
      setActiveTab(tab);
    }
  };

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: sessions } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/sessions"],
    enabled: !!profile,
  });

  const { data: activeSession } = useQuery<WorkoutSession | null>({
    queryKey: ["/api/sessions/active"],
    enabled: !!profile,
  });

  const { data: programTemplates, isLoading: isLoadingTemplates } = useQuery<Array<{ template: ProgramTemplate; exerciseCount: number; isNext: boolean }>>({
    queryKey: ["/api/program/templates"],
    enabled: !!profile,
  });

  // Fetch next template for the smart CTA button
  const { data: nextTemplate } = useQuery<{ template: ProgramTemplate; exercises: any[] } | null>({
    queryKey: ["/api/program/next"],
    enabled: !!profile && !activeSession,
  });

  // Fetch personalized training tips from database
  const { data: tips = [] } = useQuery<any[]>({
    queryKey: ["/api/tips/personalized"],
    enabled: !!profile,
  });

  // Show resume dialog when active session is detected
  useEffect(() => {
    if (activeSession && !showResumeDialog) {
      setShowResumeDialog(true);
    }
  }, [activeSession, showResumeDialog]);

  const generateWorkoutMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/workouts/generate");
      await apiRequest("POST", "/api/program/migrate");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/templates"] });
      toast({
        title: "Program genererat!",
        description: "Ditt personliga träningsprogram är klart.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ett fel uppstod",
        description: error.message || "Kunde inte generera program. Försök igen.",
        variant: "destructive",
      });
    },
  });

  const regenerateProgramMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not found");
      
      const updateData: any = {
        forceRegenerate: true,
        goalStrength: profile.goalStrength,
        goalVolume: profile.goalVolume,
        goalEndurance: profile.goalEndurance,
        goalCardio: profile.goalCardio,
        sessionsPerWeek: profile.sessionsPerWeek,
        sessionDuration: profile.sessionDuration,
      };
      
      // Only include trainingGoals if it's not null
      if (profile.trainingGoals) {
        updateData.trainingGoals = profile.trainingGoals;
      }
      
      const res = await apiRequest("PATCH", "/api/profile", updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program/templates"] });
      toast({
        title: "Program uppdaterat!",
        description: "Ditt träningsprogram har regenererats med nya pass.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ett fel uppstod",
        description: error.message || "Kunde inte uppdatera program. Försök igen.",
        variant: "destructive",
      });
    },
  });

  const handlePassClick = (templateId: string, isNext: boolean) => {
    setLocation(`/edit-program/${templateId}`);
  };

  // Smart CTA: Start next workout or resume active session
  const handleStartWorkout = async () => {
    if (activeSession) {
      // Resume active session
      handleResumeSession();
      return;
    }

    if (!nextTemplate) {
      toast({
        title: "Inget program tillgängligt",
        description: "Generera ett träningsprogram först.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Start new session with next template
      setLocation(`/session/start?templateId=${nextTemplate.template.id}`);
    } catch (error) {
      console.error("Error starting workout:", error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte starta träningspass. Försök igen.",
        variant: "destructive",
      });
    }
  };

  // Calculate activity percentage
  const calculateActivityPercent = () => {
    if (!sessions || !profile) return 0;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const completedThisWeek = sessions.filter(session => {
      if (!session.completedAt) return false;
      const completedDate = new Date(session.completedAt);
      return completedDate >= startOfWeek;
    }).length;
    
    const targetSessions = profile.sessionsPerWeek || 3;
    return Math.min((completedThisWeek / targetSessions) * 100, 100);
  };

  // Calculate recovery percentage (reversed: 0 days = 0% red, 3+ days = 100% blue)
  const calculateRecoveryPercent = () => {
    if (!sessions || sessions.length === 0) return 100;
    
    const completedSessions = sessions.filter(s => s.completedAt);
    if (completedSessions.length === 0) return 100;
    
    const sortedSessions = [...completedSessions].sort((a, b) => 
      new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );
    
    const lastSession = sortedSessions[0];
    const now = new Date();
    const lastSessionDate = new Date(lastSession.completedAt!);
    const daysSinceLastSession = (now.getTime() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastSession >= 3) return 100;
    return Math.min((daysSinceLastSession / 3) * 100, 100);
  };

  useEffect(() => {
    // Redirect to onboarding if:
    // 1. Profile doesn't exist (brand new user)
    // 2. Profile exists but onboarding not completed
    if (!isLoading && (!profile || !profile.onboardingCompleted)) {
      setLocation("/onboarding");
    }
  }, [profile, isLoading, setLocation]);

  // Load personalized tip when tips are available
  useEffect(() => {
    if (tips.length > 0 && !currentTip) {
      setCurrentTip(tips[0]);
    }
  }, [tips, currentTip]);

  const handleDismissTip = () => {
    if (currentTip) {
      setShowNotification(false);
      
      // Load next tip after dismissing
      setTimeout(() => {
        if (tips.length > 1) {
          const randomIndex = Math.floor(Math.random() * tips.length);
          setCurrentTip(tips[randomIndex]);
          setShowNotification(true);
        }
      }, 100);
    }
  };

  const handleResumeSession = () => {
    if (activeSession) {
      setShowResumeDialog(false);
      // Navigate to active session with sessionId and warmupDone flag
      // Only include templateId if it exists (avoid setting templateId=null)
      const params = new URLSearchParams({
        sessionId: activeSession.id,
        warmupDone: 'true',
      });
      if (activeSession.templateId) {
        params.set('templateId', activeSession.templateId);
      }
      setLocation(`/session/active?${params.toString()}`);
    }
  };

  const handleCancelResume = async () => {
    if (activeSession) {
      try {
        // Close dialog immediately
        setShowResumeDialog(false);
        
        // Optimistically update cache to null
        queryClient.setQueryData(["/api/sessions/active"], null);
        
        // Cancel the active session (marks as cancelled, saves completed exercises)
        await apiRequest("PATCH", `/api/sessions/${activeSession.id}/cancel`);
        
        // Invalidate queries to refetch from server
        queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        
        toast({
          title: "Pass avslutat",
          description: "Passet har avslutats och genomförda övningar har sparats.",
        });
      } catch (error) {
        console.error("Error canceling session:", error);
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
        toast({
          title: "Ett fel uppstod",
          description: "Kunde inte avsluta passet. Försök igen.",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!profile.onboardingCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Läser av profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden w-full">
      {/* Resume session dialog */}
      <ResumeSessionDialog
        session={activeSession || null}
        open={showResumeDialog}
        onResume={handleResumeSession}
        onCancel={handleCancelResume}
      />

      {/* Program regeneration animation overlay */}
      {regenerateProgramMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <ProgramBuildingAnimation />
        </div>
      )}
      
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="h-16 flex items-center px-4">
          {/* Left column - fixed width for balance */}
          <div className="w-12 flex-shrink-0">
            <button 
              onClick={() => setLocation("/")}
              className="hover-elevate rounded"
              data-testid="button-logo-icon"
            >
              <Logo 
                variant="icon" 
                className="h-9 w-auto"
              />
            </button>
          </div>
          
          {/* Center column - truly centered text logo */}
          <div className="flex-1 flex justify-center">
            <button 
              onClick={() => setLocation("/")}
              className="hover-elevate rounded"
              data-testid="button-logo-text"
            >
              <Logo 
                variant="text" 
                className="h-8 w-auto"
              />
            </button>
          </div>
          
          {/* Right column - same width as left for balance */}
          <div className="w-12 flex-shrink-0 flex justify-end">
            <Button 
              size="icon" 
              variant="ghost" 
              className="rounded-full relative" 
              data-testid="button-notifications"
              onClick={() => setShowNotification(!showNotification)}
            >
              <Bell className="w-8 h-8" />
              {showNotification && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {activeTab === "home" && (
        <div className="w-full max-w-full">
          {/* Smart CTA Card - Start/Resume Training */}
          {(() => {
            // Always show CTA if there's an active session or program templates exist
            if (!activeSession && !programTemplates?.length) {
              // No session and no templates - show generate program CTA
            } else if (activeSession) {
              // Active session - always show resume CTA
            } else if (nextTemplate) {
              // Has templates but no active session - check if scheduled for today
              const today = new Date().getDay();
              const todayAsIso = today === 0 ? 7 : today;
              const isScheduledToday = nextTemplate.template.dayOfWeek === todayAsIso;
              
              if (!isScheduledToday) {
                return null; // Not scheduled for today, hide CTA
              }
            }
            
            return (
              <div className="px-4 pt-6">
                <Card className="border-primary" data-testid="card-main-cta">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {activeSession ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                          Fortsätt ditt pass
                        </>
                      ) : nextTemplate ? (
                        <>
                          <Sparkles className="w-5 h-5 text-primary" />
                          Dags att träna!
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-primary" />
                          Kom igång
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {activeSession ? (
                        `Du har ett pågående träningspass`
                      ) : nextTemplate ? (
                        `${nextTemplate.template.muscleFocus || nextTemplate.template.templateName} • ${nextTemplate.exercises.length} övningar`
                      ) : (
                        `Generera ditt personliga träningsprogram`
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {programTemplates && programTemplates.length > 0 ? (
                      <Button
                        className="w-full"
                        onClick={handleStartWorkout}
                        data-testid="button-main-cta"
                      >
                        {activeSession ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Fortsätt pass
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Starta träning
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => generateWorkoutMutation.mutate()}
                        disabled={generateWorkoutMutation.isPending}
                        data-testid="button-generate-program"
                      >
                        {generateWorkoutMutation.isPending ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                            Genererar...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generera program
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <div className="px-4 mt-6">
            <ActivityRecoveryGauges 
              activityPercent={calculateActivityPercent()}
              recoveryPercent={calculateRecoveryPercent()}
            />
          </div>

          <div className="px-4 mt-6">
            <HealthMetricsCard />
          </div>

          <TipsSection />

          {showNotification && currentTip && (
            <div className="px-4 mt-6">
              <Card className="border-primary/50" data-testid="card-training-tip">
                <CardHeader>
                  <CardTitle className="text-base flex items-start justify-between">
                    <span>Träningstips</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDismissTip}
                      data-testid="button-dismiss-tip"
                    >
                      ✕
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed">{currentTip.tipText}</p>
                  {currentTip.affiliateLink && (
                    <a
                      href={currentTip.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                      data-testid="link-affiliate-product"
                    >
                      <Button size="sm" variant="outline">
                        Läs mer →
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="px-4 mt-6 pb-6">
            <PromoCard placement="dashboard-hero" />
          </div>
        </div>
      )}

      {activeTab === "programs" && (
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Träningsprogram</h2>
            <p className="text-sm text-muted-foreground">Pass {profile?.currentPassNumber || 1}/4</p>
          </div>
          
          {/* Warning if program count doesn't match profile */}
          {profile && programTemplates && programTemplates.length > 0 && 
           programTemplates.length !== profile.sessionsPerWeek && (
            <Card className="mb-4 border-destructive/50 bg-destructive/5" data-testid="card-program-mismatch-warning">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive mb-1">
                      Uppdatera ditt träningsprogram
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Din profil säger {profile.sessionsPerWeek} pass/vecka, men du har {programTemplates.length} pass. 
                      Klicka nedan för att regenerera med dina nuvarande inställningar.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => regenerateProgramMutation.mutate()}
                      disabled={regenerateProgramMutation.isPending}
                      data-testid="button-update-program"
                    >
                      {regenerateProgramMutation.isPending ? "Genererar..." : "Uppdatera program"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {programTemplates && programTemplates.length > 0 ? (
            <div className="space-y-3">
              {programTemplates.map(({ template, exerciseCount }, idx) => {
                const passNumber = idx + 1;
                const isCurrent = passNumber === (profile?.currentPassNumber || 1);
                
                return (
                  <Card 
                    key={template.id} 
                    className={`hover-elevate cursor-pointer ${isCurrent ? 'border-primary bg-primary/5' : ''}`}
                    data-testid={`card-pass-${template.templateName}`}
                    onClick={() => handlePassClick(template.id, isCurrent)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-foreground">
                              {template.muscleFocus || template.templateName}
                            </h3>
                            {isCurrent && (
                              <Badge variant="default" className="text-xs" data-testid="badge-current">
                                Nästa
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {template.dayOfWeek && (
                              <span className="font-medium" data-testid={`text-day-${template.id}`}>
                                {getShortDayName(template.dayOfWeek)} • 
                              </span>
                            )}{' '}
                            {exerciseCount} övningar • {template.estimatedDurationMinutes || 60} min
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-view-${template.templateName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/edit-program/${template.id}`);
                          }}
                        >
                          Visa
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : isLoadingTemplates ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Laddar program...</p>
            </div>
          ) : (
            <Card data-testid="card-no-program">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Generera ditt träningsprogram
                </CardTitle>
                <CardDescription>
                  Låt AI skapa ett personligt program baserat på dina mål, tillgänglig utrustning och schema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  data-testid="button-generate-program"
                  className="w-full"
                  onClick={() => generateWorkoutMutation.mutate()}
                  disabled={generateWorkoutMutation.isPending}
                >
                  {generateWorkoutMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Genererar program...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generera träningsprogram
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "stats" && (
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Statistik</h2>
          </div>

          {/* Detailed Statistics Button */}
          <Card className="mb-4 border-primary/50 bg-primary/5 hover-elevate cursor-pointer" onClick={() => setLocation("/progress")} data-testid="card-progress-stats">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Träningsstatistik</h3>
                  <p className="text-xs text-muted-foreground">Se grafer, volym och styreutveckling</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-foreground">Träningshistorik</h2>
          </div>
          
          {sessions && sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions
                .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                .map((session) => {
                  const sessionDate = new Date(session.startedAt);
                  const formattedDate = sessionDate.toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = sessionDate.toLocaleTimeString('sv-SE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <Card
                      key={session.id}
                      className="hover-elevate cursor-pointer"
                      data-testid={`card-session-${session.id}`}
                      onClick={() => setLocation(`/session/${session.id}`)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">
                              {session.sessionName}
                            </h3>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formattedDate}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{formattedTime}</span>
                              </div>
                            </div>
                            {session.notes && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {session.notes}
                              </p>
                            )}
                          </div>
                          <div className="ml-3">
                            {session.status === 'completed' ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Färdigt</span>
                              </Badge>
                            ) : session.status === 'cancelled' ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>Avbrutet</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <span>Pågående</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          ) : (
            <Card data-testid="card-stats-placeholder">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Din träningshistorik kommer att visas här när du har genomfört dina första pass
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Fixed "Starta pass" button above footer */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-background via-background to-transparent z-10">
        <Button 
          size="lg"
          className="w-full font-bold"
          onClick={() => {
            const nextTemplate = programTemplates?.find(t => t.isNext);
            if (nextTemplate) {
              setLocation(`/warmup?templateId=${nextTemplate.template.id}`);
            } else {
              setActiveTab("programs");
            }
          }}
          data-testid="button-start-pass-fixed"
        >
          Starta pass
        </Button>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
