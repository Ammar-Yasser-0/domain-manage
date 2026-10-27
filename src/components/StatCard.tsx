import { ChevronRight, type LucideIcon } from "lucide-react";
import type { DomainFilter } from "../lib/domain-list";

export type { DomainFilter } from "../lib/domain-list";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "red";
  filter: DomainFilter;
  selected: boolean;
  onClick: (filter: DomainFilter) => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  filter,
  selected,
  onClick,
}: StatCardProps) {
  return (
    <button
      aria-pressed={selected}
      className={
        "stat-card stat-card--" +
        tone +
        (selected ? " stat-card--selected" : "")
      }
      onClick={() => onClick(filter)}
      type="button"
    >
      <span className="stat-icon" aria-hidden="true">
        <Icon size={30} strokeWidth={1.9} />
      </span>
      <span className="stat-copy">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </span>
      <ChevronRight className="stat-chevron" size={20} aria-hidden="true" />
    </button>
  );
}
