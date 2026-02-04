import { useEffect, useState } from "react";

interface MovergyGaugeProps {
  value: number;
  maxValue: number;
}

export default function MovergyGauge({ value, maxValue }: MovergyGaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  const percentage = (animatedValue / maxValue) * 100;
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getGaugeColor = (percent: number) => {
    if (percent < 34) return "#ef4444";
    if (percent < 68) return "#f59e0b";
    return "#22c55e";
  };
  
  const getLabel = (percent: number) => {
    if (percent < 34) return "SEDENTARY";
    if (percent < 68) return "ACTIVE";
    return "ATHLETIC";
  };

  const angle = (percentage / 100) * 180 - 90;

  return (
    <div className="relative flex flex-col items-center justify-center py-6">
      <svg width="240" height="140" viewBox="0 0 240 140" className="overflow-visible">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        
        <path
          d={`M 35 120 A ${radius} ${radius} 0 0 1 205 120`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="16"
          strokeLinecap="round"
        />
        
        <path
          d={`M 35 120 A ${radius} ${radius} 0 0 1 205 120`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: "stroke-dashoffset 1s ease-out",
            transformOrigin: "120px 120px",
          }}
        />
        
        <g transform={`translate(120, 120) rotate(${angle})`}>
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={-radius + 8}
            stroke="hsl(var(--foreground))"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="6" fill="hsl(var(--foreground))" />
        </g>
      </svg>
      
      <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-2 text-center">
        <div className="text-xs font-semibold text-muted-foreground tracking-wide">
          {getLabel(percentage)}
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <div className="text-sm font-semibold text-foreground tracking-wider">
          MOVERGY INDEX
        </div>
        <div className="h-1 w-32 mx-auto mt-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-2xl font-bold text-foreground mt-2">
          {animatedValue}/{maxValue} <span className="text-sm font-normal text-muted-foreground">DAILY MOVEs</span>
        </div>
      </div>
    </div>
  );
}
