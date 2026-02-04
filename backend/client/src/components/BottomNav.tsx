import { Home, Dumbbell, BarChart3, User } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "home", label: "Hem", icon: Home },
    { id: "programs", label: "Program", icon: Dumbbell },
    { id: "stats", label: "Statistik", icon: BarChart3 },
    { id: "profile", label: "Profil", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[60px] hover-elevate ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "fill-current" : ""}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
