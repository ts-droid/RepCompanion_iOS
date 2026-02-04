import WorkoutHeader from "../WorkoutHeader";

export default function WorkoutHeaderExample() {
  return (
    <div>
      <WorkoutHeader
        title="STRENGTH TRAINING"
        subtitle="Chest Press Sel, Vertical Traction Sel, Lower Back Sel"
        onBack={() => console.log("Back clicked")}
        category="Styrka"
        duration="16 min"
      />
    </div>
  );
}
