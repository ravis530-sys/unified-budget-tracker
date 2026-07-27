import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CONTROLLABLE_CATEGORIES, ControllabilityType } from "@/lib/constants";

interface CategoryRow {
  category: string;
  amount: number;
  percentage: number;
  prevAmount?: number;
}

interface ReportCategoryBreakdownProps {
  data: CategoryRow[];
  totalExpenses: number;
  loading?: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const CONTROLLABILITY_STYLES: Record<ControllabilityType, { label: string; className: string }> = {
  discretionary: {
    label: "Discretionary",
    className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50",
  },
  "semi-fixed": {
    label: "Semi-fixed",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50",
  },
  fixed: {
    label: "Fixed",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400 border border-slate-200/50",
  },
};

const CATEGORY_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];
// Use hsl values directly since Tailwind JIT won't pick up dynamic classes
const BAR_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const DeltaChip = ({ current, prev }: { current: number; prev?: number }) => {
  if (!prev || prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
        up
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
          : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
      }`}
    >
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
};

const ReportCategoryBreakdown = ({ data, totalExpenses, loading }: ReportCategoryBreakdownProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
            <div className="h-2.5 bg-muted animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        No expense data for this period.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Category</span>
        <span className="text-right">Amount</span>
        <span className="text-right">vs Prev</span>
        <span className="text-right">Type</span>
      </div>
      <div className="space-y-3">
        {sorted.map((row, idx) => {
          const ctrl = CONTROLLABLE_CATEGORIES[row.category];
          const ctrlStyle = ctrl ? CONTROLLABILITY_STYLES[ctrl] : null;
          const barColor = BAR_COLORS[idx % BAR_COLORS.length];

          return (
            <div key={row.category} className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-sm">
                {/* Name + pct */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: barColor }}
                  />
                  <span className="font-medium truncate">{row.category}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {row.percentage.toFixed(1)}%
                  </span>
                </div>
                {/* Amount */}
                <span className="font-semibold tabular-nums text-right text-destructive">
                  {formatCurrency(row.amount)}
                </span>
                {/* Delta */}
                <div className="text-right flex justify-end">
                  <DeltaChip current={row.amount} prev={row.prevAmount} />
                </div>
                {/* Controllability */}
                <div className="flex justify-end">
                  {ctrlStyle && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ctrlStyle.className}`}
                    >
                      {ctrlStyle.label}
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, row.percentage)}%`,
                    backgroundColor: barColor,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="pt-3 border-t flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total Expenses</span>
        <span className="font-bold text-destructive tabular-nums">{formatCurrency(totalExpenses)}</span>
      </div>
    </div>
  );
};

export default ReportCategoryBreakdown;
export type { CategoryRow };
