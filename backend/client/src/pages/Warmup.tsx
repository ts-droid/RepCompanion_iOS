import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Activity, Bike, Waves, Flame } from "lucide-react";
import type { UserEquipment, UserProfile } from "@shared/schema";

export default function Warmup() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const templateId = searchParams.get("templateId");

  const { data: equipment, isLoading } = useQuery<UserEquipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  if (!templateId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card>
          <CardHeader>
            <CardTitle>Fel</CardTitle>
            <CardDescription>Inget träningspass valt</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")}>
              Tillbaka till Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getCardioEquipment = () => {
    if (!equipment) return [];
    
    const cardioNames = [
      "rodd",
      "rowing",
      "cykel",
      "bike",
      "bicycle",
      "löpband",
      "treadmill",
      "stairmaster",
      "stair",
      "elliptical",
    ];
    
    // Filter by selected gym first
    const gymEquipment = profile?.selectedGymId 
      ? equipment.filter((eq) => eq.gymId === profile.selectedGymId)
      : equipment;
    
    // Filter for cardio equipment and deduplicate by equipment name
    const filtered = gymEquipment.filter((eq) => {
      const name = eq.equipmentName.toLowerCase();
      return cardioNames.some((cardio) => name.includes(cardio));
    });

    // Remove duplicates by equipment name (keep first occurrence)
    const seen = new Set<string>();
    return filtered.filter((eq) => {
      const name = eq.equipmentName.toLowerCase();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  };

  const cardioEquipment = getCardioEquipment();
  const hasCardio = cardioEquipment.length > 0;

  const getWarmupIcon = (equipmentName: string) => {
    const name = equipmentName.toLowerCase();
    if (name.includes("rodd") || name.includes("rowing")) {
      return <Waves className="w-5 h-5" />;
    }
    if (name.includes("cykel") || name.includes("bike")) {
      return <Bike className="w-5 h-5" />;
    }
    if (name.includes("löpband") || name.includes("treadmill")) {
      return <Activity className="w-5 h-5" />;
    }
    return <Flame className="w-5 h-5" />;
  };

  const handleComplete = () => {
    setLocation(`/session/active?templateId=${templateId}&warmupDone=true`);
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-foreground">Uppvärmning</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-cancel"
          >
            Avbryt
          </Button>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-6 max-w-2xl mx-auto">
        <Card data-testid="card-warmup-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-primary" />
              Börja med uppvärmning
            </CardTitle>
            <CardDescription>
              5-10 minuter lätt kardio för att förbereda kroppen
            </CardDescription>
          </CardHeader>
        </Card>

        {hasCardio ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Välj en av dina tillgängliga maskiner:
            </h2>
            
            {cardioEquipment.map((eq) => (
              <Card 
                key={eq.id} 
                className="hover-elevate" 
                data-testid={`card-cardio-${eq.id}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {getWarmupIcon(eq.equipmentName)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {eq.equipmentName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        5-10 minuter, lätt tempo
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Uppvärmning utan utrustning:
            </h2>
            
            <Card data-testid="card-bodyweight-warmup">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Jumping Jacks</p>
                      <p className="text-sm text-muted-foreground">2 minuter</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Armcirklar</p>
                      <p className="text-sm text-muted-foreground">1 minut framåt, 1 minut bakåt</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Höftrotationer</p>
                      <p className="text-sm text-muted-foreground">10 åt varje håll</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Lätta knäböj</p>
                      <p className="text-sm text-muted-foreground">15 repetitioner</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Utfall framåt</p>
                      <p className="text-sm text-muted-foreground">10 per ben</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="pt-4">
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleComplete}
            data-testid="button-warmup-complete"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Klar - Börja träningspass
          </Button>
        </div>
      </div>
    </div>
  );
}
