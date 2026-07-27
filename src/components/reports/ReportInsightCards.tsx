import { AlertTriangle, CheckCircle2, Info, TrendingUp, Lightbulb } from "lucide-react";
import { CONTROLLABLE_CATEGORIES } from "@/lib/constants";
import { CategoryRow } from "./ReportCategoryBreakdown";

interface InsightInput {
  categories: CategoryRow[];
  totalExpenses: number;
  totalIncome: number;
  savingsRate: number;
}

type InsightLevel = "danger" | "warning" | "success" | "info";

interface Insight {
  id: string;
  level: InsightLevel;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const LEVEL_STYLES: Record<InsightLevel, { card: string; iconColor: string }> = {
  danger: {
    card: "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20",
    iconColor: "text-red-600 dark:text-red-400",
  },
  warning: {
    card: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  success: {
    card: "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20",
    iconColor: "text-green-600 dark:text-green-400",
  },
  info: {
    card: "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const { categories, totalExpenses, totalIncome, savingsRate } = input;

  // 1. Savings rate
  if (savingsRate < 5 && totalIncome > 0) {
    insights.push({
      id: "low-savings",
      level: "danger",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Very low savings rate",
      description: `Your savings rate is only ${savingsRate.toFixed(1)}%. Financial planning recommends saving at least 20% of income. Try cutting discretionary expenses first.`,
    });
  } else if (savingsRate < 20 && totalIncome > 0) {
    insights.push({
      id: "moderate-savings",
      level: "warning",
      icon: <TrendingUp className="h-4 w-4" />,
      title: "Savings rate below target",
      description: `Your savings rate is ${savingsRate.toFixed(1)}%, below the recommended 20%. Look for controllable expenses you can trim.`,
    });
  } else if (savingsRate >= 20) {
    insights.push({
      id: "good-savings",
      level: "success",
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: "Great savings rate!",
      description: `You're saving ${savingsRate.toFixed(1)}% of your income this period — above the recommended 20%. Keep it up!`,
    });
  }

  // 2. Categories that spiked >20% vs previous period
  const spiked = categories.filter((c) => {
    if (!c.prevAmount || c.prevAmount === 0) return false;
    return ((c.amount - c.prevAmount) / c.prevAmount) * 100 > 20;
  });
  spiked.forEach((c) => {
    const pct = (((c.amount - c.prevAmount!) / c.prevAmount!) * 100).toFixed(0);
    insights.push({
      id: `spike-${c.category}`,
      level: "warning",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${c.category} spiked ${pct}% vs last period`,
      description: `You spent ${formatCurrency(c.amount)} on ${c.category} this period vs ${formatCurrency(c.prevAmount!)} last period. Consider reviewing this category.`,
    });
  });

  // 3. Top discretionary category — improvement opportunity
  const discretionary = categories
    .filter((c) => CONTROLLABLE_CATEGORIES[c.category] === "discretionary")
    .sort((a, b) => b.amount - a.amount);

  if (discretionary.length > 0 && totalExpenses > 0) {
    const top = discretionary[0];
    const pct = ((top.amount / totalExpenses) * 100).toFixed(1);
    if (Number(pct) > 10) {
      insights.push({
        id: `top-disc-${top.category}`,
        level: "warning",
        icon: <Lightbulb className="h-4 w-4" />,
        title: `${top.category} is your biggest discretionary expense`,
        description: `${top.category} accounts for ${pct}% (${formatCurrency(top.amount)}) of your total expenses. Setting a weekly cap could significantly reduce your spending.`,
      });
    }
  }

  // 4. Categories with no prev data but significant spend (new expense)
  const newExpensive = categories.filter(
    (c) => (!c.prevAmount || c.prevAmount === 0) && c.amount > 0 && c.percentage > 5,
  );
  newExpensive.forEach((c) => {
    insights.push({
      id: `new-${c.category}`,
      level: "info",
      icon: <Info className="h-4 w-4" />,
      title: `New spend: ${c.category}`,
      description: `${formatCurrency(c.amount)} spent on ${c.category} this period — no previous period comparison available. Track this to see if it becomes recurring.`,
    });
  });

  // 5. Positive: kept expenses < income
  if (totalIncome > 0 && totalExpenses < totalIncome * 0.6) {
    insights.push({
      id: "expenses-controlled",
      level: "success",
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: "Expenses well under control",
      description: `Your expenses (${formatCurrency(totalExpenses)}) are less than 60% of your income (${formatCurrency(totalIncome)}) — excellent financial discipline!`,
    });
  }

  // Limit to 5 most actionable
  return insights.slice(0, 5);
}

interface ReportInsightCardsProps {
  categories: CategoryRow[];
  totalExpenses: number;
  totalIncome: number;
  savingsRate: number;
  loading?: boolean;
}

const ReportInsightCards = ({
  categories,
  totalExpenses,
  totalIncome,
  savingsRate,
  loading,
}: ReportInsightCardsProps) => {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const insights = generateInsights({ categories, totalExpenses, totalIncome, savingsRate });

  if (!insights.length) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Add transactions to see personalised insights.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map((insight) => {
        const style = LEVEL_STYLES[insight.level];
        return (
          <div
            key={insight.id}
            className={`flex gap-3 p-3.5 rounded-xl border transition-all ${style.card}`}
          >
            <div className={`mt-0.5 shrink-0 ${style.iconColor}`}>{insight.icon}</div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{insight.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReportInsightCards;
