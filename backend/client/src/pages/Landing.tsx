import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Dumbbell, TrendingUp, Sparkles, Zap, Target, Heart } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Gradient Background - Main Theme (Cyan to Green) */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-background -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent -z-10" />
        
        {/* Hero Content */}
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto">
            {/* Logo Icon with Background */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full blur-2xl -z-10" />
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                <Logo 
                  variant="icon" 
                  theme="main"
                  className="w-16 h-16 md:w-24 md:h-24"
                />
              </div>
            </div>
            
            {/* App Name and Tagline */}
            <div className="space-y-3">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                RepCompanion
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground">
                Din AI-drivna träningspartner
              </p>
            </div>

            {/* Description */}
            <p className="text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Personliga träningsprogram som anpassar sig efter dig. Genererade av AI, optimerade för dina mål och tillgänglig utrustning.
            </p>

            {/* Main CTA Button */}
            <Button
              data-testid="button-login"
              size="lg"
              className="text-lg h-14 px-10 w-full sm:w-auto"
              onClick={() => window.location.href = "/api/login"}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Kom igång gratis
            </Button>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-6 w-full max-w-sm">
              <div className="text-center space-y-1" data-testid="stat-ai">
                <div className="text-2xl font-bold text-primary">AI</div>
                <div className="text-xs text-muted-foreground">Personalisering</div>
              </div>
              <div className="text-center space-y-1" data-testid="stat-availability">
                <div className="text-2xl font-bold text-primary">24/7</div>
                <div className="text-xs text-muted-foreground">Tillgänglig</div>
              </div>
              <div className="text-center space-y-1" data-testid="stat-variations">
                <div className="text-2xl font-bold text-primary">∞</div>
                <div className="text-xs text-muted-foreground">Variationer</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 md:py-24 bg-card/30 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Funktioner
            </h2>
            <p className="text-muted-foreground">
              Allt du behöver för att nå dina träningmål
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <Card className="border-border/50 hover-elevate" data-testid="feature-ai-programs">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">AI-genererade program</h3>
                  <p className="text-sm text-muted-foreground">
                    Nya program varje vecka, anpassat efter dina mål och utrustning.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-border/50 hover-elevate" data-testid="feature-goal-based">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Målbaserad träning</h3>
                  <p className="text-sm text-muted-foreground">
                    Styrka, volym, uthållighet eller kondition. Du väljer fokus.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-border/50 hover-elevate" data-testid="feature-multi-gym">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Multi-gym support</h3>
                  <p className="text-sm text-muted-foreground">
                    Flera gym med olika utrustning. Programmen anpassas automatiskt.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="border-border/50 hover-elevate" data-testid="feature-progress">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Följ utvecklingen</h3>
                  <p className="text-sm text-muted-foreground">
                    Se din progression över tid och nå nya personbästa.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="border-border/50 hover-elevate" data-testid="feature-health-integration">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Hälsointegration</h3>
                  <p className="text-sm text-muted-foreground">
                    Synka med Apple Health, Google Fit och Samsung Health.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="border-border/50 hover-elevate" data-testid="feature-bulk-update">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Smart uppdatering</h3>
                  <p className="text-sm text-muted-foreground">
                    Ändra ett set - AI:n föreslår uppdateringar för resten.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto border-border/50 bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-8 md:p-12 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 border border-primary/20">
                <Activity className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl md:text-3xl font-bold">
                  Redo att börja?
                </h2>
                <p className="text-muted-foreground">
                  Skapa ett konto på 30 sekunder och få ditt första AI-genererade träningsprogram helt gratis.
                </p>
              </div>
              <Button
                data-testid="button-cta-login"
                size="lg"
                className="text-lg h-12 px-10"
                onClick={() => window.location.href = "/api/login"}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Kom igång nu
              </Button>
              <p className="text-xs text-muted-foreground pt-2">
                Genom att fortsätta godkänner du våra Användarvillkor och Integritetspolicy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Logo variant="icon" theme="main" className="w-5 h-5" />
              <span>© 2025 RepCompanion</span>
            </div>
            <div className="flex gap-6">
              <a href="#" data-testid="link-terms" className="hover-elevate px-1 py-1 rounded transition-colors">Användarvillkor</a>
              <a href="#" data-testid="link-privacy" className="hover-elevate px-1 py-1 rounded transition-colors">Integritet</a>
              <a href="#" data-testid="link-support" className="hover-elevate px-1 py-1 rounded transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
