import React from "react";

export function RunningStickman() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 p-8">
      {/* Running Stickman Animation */}
      <div className="relative w-64 h-32">
        <svg
          className="stickman-running"
          width="100"
          height="100"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Head */}
          <circle cx="50" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          
          {/* Body */}
          <line x1="50" y1="28" x2="50" y2="55" stroke="currentColor" strokeWidth="2" />
          
          {/* Left arm */}
          <line 
            x1="50" 
            y1="35" 
            x2="35" 
            y2="45" 
            stroke="currentColor" 
            strokeWidth="2"
            className="arm-left"
          />
          
          {/* Right arm */}
          <line 
            x1="50" 
            y1="35" 
            x2="65" 
            y2="25" 
            stroke="currentColor" 
            strokeWidth="2"
            className="arm-right"
          />
          
          {/* Left leg */}
          <line 
            x1="50" 
            y1="55" 
            x2="35" 
            y2="75" 
            stroke="currentColor" 
            strokeWidth="2"
            className="leg-left"
          />
          
          {/* Right leg */}
          <line 
            x1="50" 
            y1="55" 
            x2="65" 
            y2="75" 
            stroke="currentColor" 
            strokeWidth="2"
            className="leg-right"
          />
        </svg>
        
        {/* Track/Ground line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border"></div>
      </div>

      {/* Loading Text */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-primary animate-pulse">
          Ditt nya träningsprogram skapas!
        </h3>
        <p className="text-muted-foreground">
          AI analyserar dina mål och skapar ett skräddarsytt program...
        </p>
      </div>

      <style>{`
        .stickman-running {
          animation: run 1s infinite ease-in-out;
          color: hsl(var(--primary));
        }

        @keyframes run {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(20px);
          }
        }

        .arm-left {
          animation: swing-left 0.5s infinite ease-in-out;
          transform-origin: 50px 35px;
        }

        .arm-right {
          animation: swing-right 0.5s infinite ease-in-out;
          transform-origin: 50px 35px;
        }

        .leg-left {
          animation: swing-right 0.5s infinite ease-in-out;
          transform-origin: 50px 55px;
        }

        .leg-right {
          animation: swing-left 0.5s infinite ease-in-out;
          transform-origin: 50px 55px;
        }

        @keyframes swing-left {
          0%, 100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(-20deg);
          }
        }

        @keyframes swing-right {
          0%, 100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(20deg);
          }
        }
      `}</style>
    </div>
  );
}
