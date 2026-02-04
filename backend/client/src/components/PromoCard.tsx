import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PromoContent } from "@shared/schema";

interface PromoCardProps {
  placement: string;
  className?: string;
  metadata?: Record<string, unknown>;
}

export function PromoCard({ placement, className, metadata }: PromoCardProps) {
  const { data: promo, isLoading } = useQuery<PromoContent | null>({
    queryKey: ["/api/promos", placement],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/promos/${placement}`);
      return response.json();
    },
  });

  const trackImpressionMutation = useMutation({
    mutationFn: async (promoId: string) => {
      return apiRequest("POST", `/api/promos/${promoId}/impression`, { 
        placement,
        metadata: metadata || {}
      });
    },
  });

  useEffect(() => {
    if (promo?.id && trackImpressionMutation.status === "idle") {
      trackImpressionMutation.mutate(promo.id);
    }
  }, [placement, promo?.id, trackImpressionMutation.status, trackImpressionMutation.mutate]);

  const trackClickMutation = useMutation({
    mutationFn: async (promoId: string) => {
      return apiRequest("POST", `/api/affiliate/click/${promoId}`, {
        metadata: metadata || {}
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      }
    },
  });

  const handleClick = () => {
    if (promo && promo.ctaUrl) {
      trackClickMutation.mutate(promo.id);
    }
  };

  if (isLoading || !promo) {
    return null;
  }

  return (
    <Card className={className} data-testid={`promo-card-${placement}`}>
      <CardHeader>
        {promo.title && <CardTitle className="text-base">{promo.title}</CardTitle>}
        {promo.partnerName && (
          <CardDescription className="text-xs">
            {promo.partnerName}
          </CardDescription>
        )}
      </CardHeader>
      {(promo.description || promo.ctaText) && (
        <CardContent className="space-y-3">
          {promo.description && (
            <p className="text-sm text-muted-foreground">{promo.description}</p>
          )}
          {promo.ctaText && promo.ctaUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
              data-testid="button-promo-cta"
              className="w-full"
            >
              {promo.ctaText}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
