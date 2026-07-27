import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addWeeks, subWeeks, addMonths, subMonths, addQuarters, subQuarters, addYears, subYears,
  startOfWeek, endOfWeek, format, getISOWeek, getYear, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
} from "date-fns";

export type PeriodType = "weekly" | "monthly" | "quarterly" | "yearly";

interface ReportPeriodSelectorProps {
  period: PeriodType;
  onPeriodChange: (p: PeriodType) => void;
  anchor: Date; // the "current" date driving the period
  onAnchorChange: (d: Date) => void;
}

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function getPeriodLabel(period: PeriodType, anchor: Date): string {
  switch (period) {
    case "weekly": {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      const week = getISOWeek(anchor);
      return `Week ${week}, ${getYear(anchor)} (${format(ws, "MMM d")} – ${format(we, "MMM d")})`;
    }
    case "monthly":
      return format(anchor, "MMMM yyyy");
    case "quarterly": {
      const q = Math.floor(anchor.getMonth() / 3) + 1;
      const qs = startOfQuarter(anchor);
      const qe = endOfQuarter(anchor);
      return `Q${q} ${format(anchor, "yyyy")} (${format(qs, "MMM")} – ${format(qe, "MMM")})`;
    }
    case "yearly":
      return format(anchor, "yyyy");
  }
}

export function navigateAnchor(direction: "prev" | "next", period: PeriodType, anchor: Date): Date {
  const fn = direction === "prev" ? -1 : 1;
  switch (period) {
    case "weekly":  return fn === -1 ? subWeeks(anchor, 1)    : addWeeks(anchor, 1);
    case "monthly": return fn === -1 ? subMonths(anchor, 1)   : addMonths(anchor, 1);
    case "quarterly": return fn === -1 ? subQuarters(anchor, 1) : addQuarters(anchor, 1);
    case "yearly":  return fn === -1 ? subYears(anchor, 1)    : addYears(anchor, 1);
  }
}

export function getPeriodRange(period: PeriodType, anchor: Date): { start: Date; end: Date } {
  switch (period) {
    case "weekly":
      return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
    case "monthly":
      return { start: new Date(anchor.getFullYear(), anchor.getMonth(), 1), end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) };
    case "quarterly":
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
    case "yearly":
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }
}

const ReportPeriodSelector = ({ period, onPeriodChange, anchor, onAnchorChange }: ReportPeriodSelectorProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      {/* Period toggle */}
      <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              period === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onAnchorChange(navigateAnchor("prev", period, anchor))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold min-w-[220px] text-center tabular-nums">
          {getPeriodLabel(period, anchor)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onAnchorChange(navigateAnchor("next", period, anchor))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ReportPeriodSelector;
