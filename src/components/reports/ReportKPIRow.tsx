import { TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KPIData {
  income: number;
  expenses: number;
  investments: number;
  netSavings: number;
  savingsRate: number;
  prevExpenses?: number;
}

interface ReportKPIRowProps {
  data: KPIData;
  loading?: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const DeltaBadge = ({ current, prev }: { current: number; prev?: number }) => {
  if (prev === undefined || prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md ${
        up ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
};

const ReportKPIRow = ({ data, loading }: ReportKPIRowProps) => {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Income",
      value: formatCurrency(data.income),
      sub: "For the period",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      color: "text-green-600",
    },
    {
      title: "Total Expenses",
      value: formatCurrency(data.expenses),
      sub: "For the period",
      icon: <TrendingDown className="h-4 w-4 text-destructive" />,
      color: "text-destructive",
      delta: <DeltaBadge current={data.expenses} prev={data.prevExpenses} />,
    },
    {
      title: "Investments",
      value: formatCurrency(data.investments),
      sub: "For the period",
      icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
      color: "text-orange-500",
    },
    {
      title: "Net Savings",
      value: formatCurrency(data.netSavings),
      sub: "Income − Expenses − Investments",
      icon: <Wallet className="h-4 w-4 text-blue-600" />,
      color: data.netSavings >= 0 ? "text-blue-600" : "text-destructive",
    },
    {
      title: "Savings Rate",
      value: `${data.savingsRate.toFixed(1)}%`,
      sub: "Of total income",
      icon: <PiggyBank className="h-4 w-4 text-purple-600" />,
      color: data.savingsRate >= 20 ? "text-purple-600" : data.savingsRate >= 10 ? "text-amber-600" : "text-destructive",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ background: "radial-gradient(circle at top right, currentColor, transparent 60%)" }}
          />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">{card.sub}</p>
              {card.delta}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReportKPIRow;
export type { KPIData };
