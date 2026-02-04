import { useQuery } from "@tanstack/react-query";
import type { TrainingTip } from "@shared/schema";

interface UseTrainingTipsOptions {
  category?: string;
  workoutType?: string;
  isActive?: boolean;
}

/**
 * Fetch training tips from the database API
 * Replaces hardcoded tips from trainingTips.ts
 */
export function useTrainingTips(options?: UseTrainingTipsOptions) {
  const queryParams = new URLSearchParams();
  
  if (options?.category) {
    queryParams.set("category", options.category);
  }
  
  if (options?.workoutType) {
    queryParams.set("workoutType", options.workoutType);
  }
  
  if (options?.isActive !== undefined) {
    queryParams.set("isActive", String(options.isActive));
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/tips?${queryString}` : "/api/tips";
  
  return useQuery<TrainingTip[]>({
    queryKey: ["/api/tips", options],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch training tips");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

/**
 * Get a random tip from the list, optionally filtered by category
 */
export function getRandomTip(
  tips: TrainingTip[], 
  excludeIds: string[] = [],
  category?: TrainingTip["category"]
): TrainingTip | null {
  let filteredTips = tips.filter(tip => !excludeIds.includes(tip.id));
  
  if (category) {
    filteredTips = filteredTips.filter(tip => tip.category === category);
  }
  
  if (filteredTips.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * filteredTips.length);
  return filteredTips[randomIndex];
}

/**
 * Get dismissed tip IDs from localStorage
 */
export function getDismissedTips(): string[] {
  try {
    const stored = localStorage.getItem("dismissedTips");
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    const today = new Date().toDateString();
    
    // Reset dismissed tips daily
    if (data.date !== today) {
      localStorage.removeItem("dismissedTips");
      return [];
    }
    
    return data.tipIds || [];
  } catch {
    return [];
  }
}

/**
 * Mark a tip as dismissed
 */
export function dismissTip(tipId: string): void {
  try {
    const dismissed = getDismissedTips();
    const today = new Date().toDateString();
    
    localStorage.setItem("dismissedTips", JSON.stringify({
      date: today,
      tipIds: [...dismissed, tipId],
    }));
  } catch (error) {
    console.error("Failed to save dismissed tip:", error);
  }
}
