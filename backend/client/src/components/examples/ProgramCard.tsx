import ProgramCard from "../ProgramCard";

export default function ProgramCardExample() {
  return (
    <div className="p-4 space-y-4">
      <ProgramCard
        title="ETAPP 1"
        phase="Pass 1"
        progress={0}
        totalPhases={4}
        exercises={6}
        moves={424}
        duration="22:22 min"
        status="active"
        onClick={() => console.log("Program clicked")}
      />
    </div>
  );
}
