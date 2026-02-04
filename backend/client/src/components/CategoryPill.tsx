import { Badge } from "@/components/ui/badge";

interface CategoryPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export default function CategoryPill({ label, active = false, onClick }: CategoryPillProps) {
  return (
    <Badge
      variant={active ? "default" : "secondary"}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
        active ? "bg-primary text-primary-foreground" : ""
      }`}
      onClick={onClick}
      data-testid={`pill-category-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
    </Badge>
  );
}
