import ExerciseListItem from "../ExerciseListItem";

export default function ExerciseListItemExample() {
  return (
    <div className="p-4 space-y-3">
      <ExerciseListItem
        name="Benpress"
        category="LEG PRESS SEL"
        sets={4}
        reps={8}
        weight={90}
        onClick={() => console.log("Exercise clicked")}
      />
      <ExerciseListItem
        name="Extension båda benen"
        category="LEG EXTENSION SEL"
        sets={3}
        reps={10}
        weight={37.5}
        onClick={() => console.log("Exercise clicked")}
      />
    </div>
  );
}
