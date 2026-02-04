import OnboardingCard from "../OnboardingCard";

export default function OnboardingCardExample() {
  return (
    <div className="p-4 space-y-4">
      <OnboardingCard
        icon="💪"
        title="Fitness"
        description="Komma i form och må bättre"
        illustration="💪"
        onClick={() => console.log("Fitness selected")}
      />
      <OnboardingCard
        icon="⚽"
        title="Sport"
        description="Öka min förmåga i min favoritiport"
        illustration="⚽"
        onClick={() => console.log("Sport selected")}
      />
    </div>
  );
}
