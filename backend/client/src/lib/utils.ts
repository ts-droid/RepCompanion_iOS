import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDayName(dayOfWeek: number | null | undefined): string {
  if (!dayOfWeek) return "";
  
  const dayNames: Record<number, string> = {
    1: "Måndag",
    2: "Tisdag",
    3: "Onsdag",
    4: "Torsdag",
    5: "Fredag",
    6: "Lördag",
    7: "Söndag"
  };
  
  return dayNames[dayOfWeek] || "";
}

export function getShortDayName(dayOfWeek: number | null | undefined): string {
  if (!dayOfWeek) return "";
  
  const shortDayNames: Record<number, string> = {
    1: "Mån",
    2: "Tis",
    3: "Ons",
    4: "Tor",
    5: "Fre",
    6: "Lör",
    7: "Sön"
  };
  
  return shortDayNames[dayOfWeek] || "";
}

export function normalizeTestId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatExerciseWeight(weight: number | undefined | null, exerciseName: string): string {
  if (!weight) return "";
  
  const isDumbbell = exerciseName.toLowerCase().includes("dumbbell");
  
  if (isDumbbell) {
    const perSide = weight / 2;
    return `2x${perSide}kg`;
  }
  
  return `${weight}kg`;
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    const isValidYouTubeDomain = (host: string): boolean => {
      if (host === 'youtu.be') return true;
      
      const parts = host.split('.');
      if (parts.length < 2) return false;
      
      const lastTwo = parts.slice(-2).join('.');
      if (lastTwo === 'youtube.com' || lastTwo === 'youtube-nocookie.com') {
        return true;
      }
      
      if (parts.length >= 3) {
        const lastThree = parts.slice(-3).join('.');
        if (lastThree === 'youtube-nocookie.com') return true;
      }
      
      return false;
    };
    
    if (!isValidYouTubeDomain(hostname)) return null;
    
    if (hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0].split('/')[0];
    }
    
    const vParam = urlObj.searchParams.get('v');
    if (vParam) return vParam;
    
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'embed' || pathParts[0] === 'shorts' || pathParts[0] === 'v') {
      return pathParts[1] || null;
    }
    
    return null;
  } catch {
    return null;
  }
}
