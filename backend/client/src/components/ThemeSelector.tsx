import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { Check } from "lucide-react";

interface ThemeOption {
  id: Theme;
  name: string;
  gradient: string;
}

const themeOptions: ThemeOption[] = [
  {
    id: "main",
    name: "Main",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #14b8a6 50%, #22c55e 100%)",
  },
  {
    id: "forest",
    name: "Forest",
    gradient: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
  },
  {
    id: "purple",
    name: "Purple",
    gradient: "linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
  },
  {
    id: "slate",
    name: "Slate",
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
  },
  {
    id: "crimson",
    name: "Crimson",
    gradient: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
  },
  {
    id: "pink",
    name: "Pink",
    gradient: "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
  },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Välj Tema</h3>
        <p className="text-sm text-muted-foreground">
          Anpassa appens utseende med ditt favoritfärgschema
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {themeOptions.map((option) => (
          <button
            key={option.id}
            data-testid={`theme-option-${option.id}`}
            onClick={() => setTheme(option.id)}
            className="relative flex flex-col items-center gap-2 group"
            aria-label={`Välj ${option.name} tema`}
          >
            <div
              className="relative w-16 h-16 rounded-full transition-all duration-200 hover-elevate active-elevate-2"
              style={{ background: option.gradient }}
            >
              {theme === option.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-5 h-5 text-black" />
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
              {option.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
