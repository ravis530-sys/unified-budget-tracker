import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { PeriodType } from "./ReportPeriodSelector";

interface TrendPoint {
  label: string;
  expenses: number;
  income: number;
  investments: number;
}

interface ReportTrendChartProps {
  data: TrendPoint[];
  period: PeriodType;
  loading?: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-xl shadow-lg p-3 text-sm space-y-1 min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums" style={{ color: p.color }}>
            {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const ReportTrendChart = ({ data, period, loading }: ReportTrendChartProps) => {
  if (loading) {
    return (
      <div className="h-64 bg-muted/30 animate-pulse rounded-xl flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading chart…</div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No transaction data for this period.
      </div>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expenses, d.investments]));
  const yDomain = [0, Math.ceil(maxVal * 1.15)];

  const periodLabel: Record<PeriodType, string> = {
    weekly: "Day",
    monthly: "Week",
    quarterly: "Month",
    yearly: "Month",
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Breakdown by {periodLabel[period]} — bars = Expenses · line = Income
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.9} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.9} />
              <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 100000
                ? `₹${(v / 100000).toFixed(1)}L`
                : v >= 1000
                ? `₹${(v / 1000).toFixed(0)}K`
                : `₹${v}`
            }
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            domain={yDomain}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Bar dataKey="expenses" name="Expenses" fill="url(#expGrad)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="investments" name="Investments" fill="url(#invGrad)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "hsl(var(--chart-2))", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReportTrendChart;
export type { TrendPoint };
