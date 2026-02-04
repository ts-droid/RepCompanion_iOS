import { storage } from "./storage";
import type { PromoContent, UserSubscription } from "@shared/schema";

export interface PromoFilterOptions {
  userId: string;
  placement: string;
}

export class PromoService {
  async getEligiblePromo(options: PromoFilterOptions): Promise<PromoContent | null> {
    const { userId, placement } = options;

    const subscription = await storage.getUserSubscription(userId);
    if (subscription && subscription.status === "premium") {
      return null;
    }

    const prefs = await storage.getNotificationPreferences(userId);
    if (prefs && !prefs.affiliateOffers) {
      return null;
    }

    const activePromos = await storage.getActivePromosByPlacement(placement);
    if (activePromos.length === 0) {
      return null;
    }

    const eligiblePromos: PromoContent[] = [];

    for (const promo of activePromos) {
      const isWithinFrequencyCap = await this.checkFrequencyCap(userId, promo);
      
      if (isWithinFrequencyCap) {
        eligiblePromos.push(promo);
      }
    }

    if (eligiblePromos.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * eligiblePromos.length);
    return eligiblePromos[randomIndex];
  }

  private async checkFrequencyCap(userId: string, promo: PromoContent): Promise<boolean> {
    const frequencyCapHours = promo.frequencyCapHours || 24;
    
    const recentImpressions = await storage.getUserRecentImpressions(
      userId,
      promo.id,
      frequencyCapHours
    );

    return recentImpressions.length === 0;
  }

  async trackImpression(userId: string, promoId: string, placement: string, metadata?: Record<string, unknown>): Promise<void> {
    await storage.trackPromoImpression({
      userId,
      promoId,
      placement,
      metadata: metadata || null,
    });
  }

  async trackClick(userId: string, promoId: string, clickedUrl: string, metadata?: Record<string, unknown>): Promise<void> {
    await storage.trackAffiliateClick({
      userId,
      promoId,
      clickedUrl,
      metadata: metadata || null,
    });
  }
}

export const promoService = new PromoService();
