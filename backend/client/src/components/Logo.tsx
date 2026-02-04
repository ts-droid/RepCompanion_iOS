import { useTheme } from "@/contexts/ThemeContext";

// Logo imports
import logoMain from "@assets/logos/logo-main.png";
import logoForest from "@assets/logos/logo-forest.png";
import logoPurple from "@assets/logos/logo-purple.png";
import logoOcean from "@assets/logos/logo-ocean.png";
import logoSunset from "@assets/logos/logo-sunset.png";
import logoSlate from "@assets/logos/logo-slate.png";
import logoCrimson from "@assets/logos/logo-crimson.png";
import logoPink from "@assets/logos/logo-pink.png";

// Text logo imports
import textLogoMain from "@assets/logos/textlogo-main.png";
import textLogoForest from "@assets/logos/textlogo-forest.png";
import textLogoPurple from "@assets/logos/textlogo-purple.png";
import textLogoOcean from "@assets/logos/textlogo-ocean.png";
import textLogoSunset from "@assets/logos/textlogo-sunset.png";
import textLogoSlate from "@assets/logos/textlogo-slate.png";
import textLogoCrimson from "@assets/logos/textlogo-crimson.png";
import textLogoPink from "@assets/logos/textlogo-pink.png";

const iconLogoMap: Record<string, string> = {
  main: logoMain,
  forest: logoForest,
  purple: logoPurple,
  ocean: logoOcean,
  sunset: logoSunset,
  slate: logoSlate,
  crimson: logoCrimson,
  pink: logoPink,
};

const textLogoMap: Record<string, string> = {
  main: textLogoMain,
  forest: textLogoForest,
  purple: textLogoPurple,
  ocean: textLogoOcean,
  sunset: textLogoSunset,
  slate: textLogoSlate,
  crimson: textLogoCrimson,
  pink: textLogoPink,
};

interface LogoProps {
  variant?: "icon" | "text";
  className?: string;
  theme?: string;
}

export function Logo({ variant = "icon", className = "", theme }: LogoProps) {
  const { theme: contextTheme } = useTheme();

  const currentTheme = theme || contextTheme;
  const logoMap = variant === "icon" ? iconLogoMap : textLogoMap;
  const logoSrc = logoMap[currentTheme] || logoMap.main;

  return (
    <img
      src={logoSrc}
      alt="RepCompanion"
      className={className}
      data-testid={`logo-${variant}-${currentTheme}`}
    />
  );
}
