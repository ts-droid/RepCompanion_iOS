import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export type Theme = "main" | "forest" | "purple" | "ocean" | "sunset" | "slate" | "crimson" | "pink";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("main");
  const [initialized, setInitialized] = useState(false);
  
  const { data: profile, isLoading: profileLoading } = useQuery<{ theme?: string }>({
    queryKey: ["/api/profile"],
    retry: 1,
  });

  useEffect(() => {
    if (initialized || profileLoading) return;
    
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
    }
    
    const profileTheme = profile?.theme;
    
    let finalTheme: Theme = "main";
    
    if (profileTheme && isValidTheme(profileTheme)) {
      finalTheme = profileTheme;
    } else if (stored && isValidTheme(stored)) {
      finalTheme = stored;
    }
    
    setThemeState(finalTheme);
    try {
      localStorage.setItem("theme", finalTheme);
    } catch {
    }
    applyThemeToDocument(finalTheme);
    setInitialized(true);
  }, [profile, profileLoading, initialized]);

  const setTheme = async (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      try {
        localStorage.setItem("theme", newTheme);
      } catch {
      }
      applyThemeToDocument(newTheme);
      
      await apiRequest("PATCH", "/api/profile", { theme: newTheme });
      
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    } catch {
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function isValidTheme(value: string): value is Theme {
  return ["main", "forest", "purple", "ocean", "sunset", "slate", "crimson", "pink"].includes(value);
}
