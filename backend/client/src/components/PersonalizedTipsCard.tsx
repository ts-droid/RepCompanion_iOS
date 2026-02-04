import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfileTrainingTip } from "@shared/schema";

interface PersonalizedTipsCardProps {
  limit?: number;
  category?: string;
  onSeeMore?: () => void;
}

export function PersonalizedTipsCard({ limit = 3, category, onSeeMore }: PersonalizedTipsCardProps) {
  const endpoint = category 
    ? `/api/tips/personalized/${encodeURIComponent(category)}?limit=${limit}`
    : `/api/tips/personalized?limit=${limit}`;
    
  const { data, isLoading, error } = useQuery<ProfileTrainingTip[]>({
    queryKey: category 
      ? ["/api/tips/personalized", category, limit]
      : ["/api/tips/personalized", limit],
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch personalized tips');
      }
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const tips = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <Card data-testid="card-personalized-tips-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Personliga Träningstips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tips.length === 0) {
    return (
      <Card data-testid="card-personalized-tips-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Personliga Träningstips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Inga personaliserade tips hittades för din profil.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getCategoryVariant = (cat: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      "Kost": "default",
      "Träning": "default",
      "Återhämtning": "secondary",
      "Motivation": "secondary",
      "Hälsa": "outline",
    };
    return variants[cat] || "default";
  };

  return (
    <Card data-testid="card-personalized-tips">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Personliga Träningstips
        </CardTitle>
        {onSeeMore && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSeeMore}
            data-testid="button-see-more-tips"
            className="text-xs"
          >
            Se alla
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {tips.map((tip) => (
          <div
            key={tip.id}
            data-testid={`tip-${tip.id}`}
            className="flex gap-3 p-3 rounded-md hover-elevate active-elevate-2 transition-all cursor-pointer"
          >
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 space-y-1">
              <p className="text-sm leading-relaxed">{tip.tipText}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant={getCategoryVariant(tip.category)}
                  className="text-xs"
                  data-testid={`badge-category-${tip.id}`}
                >
                  {tip.category}
                </Badge>
                {tip.sport && (
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    data-testid={`badge-sport-${tip.id}`}
                  >
                    {tip.sport}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
