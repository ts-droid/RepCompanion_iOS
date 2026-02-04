import CategoryPill from "../CategoryPill";

export default function CategoryPillExample() {
  return (
    <div className="p-4 flex gap-2 flex-wrap">
      <CategoryPill label="Styrka" active onClick={() => console.log("Styrka clicked")} />
      <CategoryPill label="Kondition" onClick={() => console.log("Kondition clicked")} />
      <CategoryPill label="Uppvärmning" onClick={() => console.log("Uppvärmning clicked")} />
      <CategoryPill label="5 min" onClick={() => console.log("5 min clicked")} />
    </div>
  );
}
