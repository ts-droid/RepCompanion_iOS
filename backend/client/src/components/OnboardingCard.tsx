import { Card } from "@/components/ui/card";

interface OnboardingCardProps {
  icon: string;
  title: string;
  description: string;
  illustration?: string;
  onClick?: () => void;
}

export default function OnboardingCard({ 
  icon, 
  title, 
  description, 
  illustration,
  onClick 
}: OnboardingCardProps) {
  return (
    <Card 
      className="p-6 cursor-pointer hover-elevate active-elevate-2 transition-transform relative overflow-hidden"
      onClick={onClick}
      data-testid={`card-onboarding-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex flex-col h-full">
        <div className="text-3xl mb-4">{icon}</div>
        <h3 className="text-xl font-bold text-primary mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        
        {illustration && (
          <div className="absolute right-4 bottom-4 opacity-20">
            <div className="text-6xl text-primary">{illustration}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
