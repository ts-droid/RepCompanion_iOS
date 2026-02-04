import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, Zap, Apple, Moon, Dumbbell } from "lucide-react";
import type { ProfileTrainingTip } from "@shared/schema";

const categoryConfig: Record<string, { icon: React.ReactNode; title: string }> = {
  recovery: {
    icon: <Moon className="w-4 h-4 text-blue-500" />,
    title: "Återhämtning",
  },
  nutrition: {
    icon: <Apple className="w-4 h-4 text-green-500" />,
    title: "Näring",
  },
  progression: {
    icon: <Zap className="w-4 h-4 text-amber-500" />,
    title: "Träning",
  },
  technique: {
    icon: <Dumbbell className="w-4 h-4 text-purple-500" />,
    title: "Teknik",
  },
};

export function TipsSection() {
  const { data: tips = [], isLoading } = useQuery<ProfileTrainingTip[]>({
    queryKey: ["/api/tips/personalized", 1],
    queryFn: async () => {
      const response = await fetch(`/api/tips/personalized?limit=1`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch tips");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 mt-6" data-testid="section-personalized-tips">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Personliga tips
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Anpassade råd för din träning
          </p>
        </div>
        <Card className="animate-pulse" data-testid="card-tip-loading">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-12 bg-muted rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tips.length === 0) return null;

  const tip = tips[0];
  const config = categoryConfig[tip.category] || {
    icon: <Lightbulb className="w-4 h-4 text-primary" />,
    title: tip.category,
  };

  return (
    <div className="px-4 mt-6" data-testid="section-personalized-tips">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          Personliga tips
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Anpassade råd för din träning
        </p>
      </div>
      <Card className="hover-elevate transition-all" data-testid="card-tip">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {config.icon}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {config.title}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {tip.tipText}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
