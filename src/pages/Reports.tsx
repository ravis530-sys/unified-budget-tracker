import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut, Wallet as WalletIcon, CalendarDays, Users, Target, BarChart2,
  ChevronDown, ChevronRight, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  eachWeekOfInterval, eachMonthOfInterval, eachDayOfInterval,
  startOfMonth, endOfMonth, getISOWeek, getYear,
} from "date-fns";
import { useHousehold } from "@/hooks/useHousehold";
import HouseholdSwitcher from "@/components/HouseholdSwitcher";
import ReportPeriodSelector, {
  PeriodType, getPeriodRange, getPeriodLabel, navigateAnchor,
} from "@/components/reports/ReportPeriodSelector";
import ReportKPIRow, { KPIData } from "@/components/reports/ReportKPIRow";
import ReportTrendChart, { TrendPoint } from "@/components/reports/ReportTrendChart";
import ReportCategoryBreakdown, { CategoryRow } from "@/components/reports/ReportCategoryBreakdown";
import ReportInsightCards from "@/components/reports/ReportInsightCards";

// ── helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

interface Transaction {
  id: string;
  type: "income" | "expense" | "investment";
  amount: number;
  category: string;
  transaction_date: string;
  payment_method?: string | null;
  remarks?: string | null;
}

// Build sub-period buckets for the trend chart
function buildTrendPoints(period: PeriodType, anchor: Date, txns: Transaction[]): TrendPoint[] {
  const { start, end } = getPeriodRange(period, anchor);

  const bucket = (label: string): TrendPoint => ({ label, expenses: 0, income: 0, investments: 0 });

  const add = (points: TrendPoint[], date: string, type: string, amount: number) => {
    const p = points.find((pt) => pt.label === date);
    if (!p) return;
    if (type === "expense") p.expenses += amount;
    else if (type === "income") p.income += amount;
    else if (type === "investment") p.investments += amount;
  };

  let points: TrendPoint[] = [];

  if (period === "weekly") {
    // sub-period = each day of the week
    const days = eachDayOfInterval({ start, end });
    points = days.map((d) => bucket(format(d, "EEE d")));
    txns.forEach((t) => {
      const label = format(new Date(t.transaction_date), "EEE d");
      add(points, label, t.type, Number(t.amount));
    });
  } else if (period === "monthly") {
    // sub-period = each week of the month
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    points = weeks.map((ws) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      return bucket(`Wk ${getISOWeek(ws)}`);
    });
    txns.forEach((t) => {
      const d = new Date(t.transaction_date);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const label = `Wk ${getISOWeek(ws)}`;
      add(points, label, t.type, Number(t.amount));
    });
  } else if (period === "quarterly") {
    // sub-period = each month of the quarter
    const months = eachMonthOfInterval({ start, end });
    points = months.map((m) => bucket(format(m, "MMM")));
    txns.forEach((t) => {
      const label = format(new Date(t.transaction_date), "MMM");
      add(points, label, t.type, Number(t.amount));
    });
  } else {
    // yearly: each month
    const months = eachMonthOfInterval({ start, end });
    points = months.map((m) => bucket(format(m, "MMM")));
    txns.forEach((t) => {
      const label = format(new Date(t.transaction_date), "MMM");
      add(points, label, t.type, Number(t.amount));
    });
  }

  return points;
}

function buildCategoryRows(
  current: Transaction[],
  previous: Transaction[],
): { rows: CategoryRow[]; total: number } {
  const expenses = current.filter((t) => t.type === "expense" && t.category !== "Credit Card Bill");
  const prevExpenses = previous.filter((t) => t.type === "expense" && t.category !== "Credit Card Bill");

  const curr: Record<string, number> = {};
  const prev: Record<string, number> = {};
  expenses.forEach((t) => { curr[t.category] = (curr[t.category] || 0) + Number(t.amount); });
  prevExpenses.forEach((t) => { prev[t.category] = (prev[t.category] || 0) + Number(t.amount); });

  const total = Object.values(curr).reduce((s, v) => s + v, 0);

  const rows: CategoryRow[] = Object.entries(curr).map(([category, amount]) => ({
    category,
    amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
    prevAmount: prev[category],
  }));

  return { rows, total };
}

function buildKPI(current: Transaction[], previous: Transaction[]): KPIData {
  const expenses = current.filter((t) => t.type === "expense" && t.category !== "Credit Card Bill");
  const income = current.filter((t) => t.type === "income");
  const investments = current.filter((t) => t.type === "investment");
  const prevExpenses = previous.filter((t) => t.type === "expense" && t.category !== "Credit Card Bill");

  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalInvestments = investments.reduce((s, t) => s + Number(t.amount), 0);
  const prevTotal = prevExpenses.reduce((s, t) => s + Number(t.amount), 0);
  const netSavings = totalIncome - totalExpenses - totalInvestments;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return {
    income: totalIncome,
    expenses: totalExpenses,
    investments: totalInvestments,
    netSavings,
    savingsRate,
    prevExpenses: prevTotal,
  };
}

// ── Reports Page ──────────────────────────────────────────────────────────────

const Reports = () => {
  const [user, setUser] = useState<User | null>(null);
  const [scope, setScope] = useState<"individual" | "family">("individual");
  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Data state
  const [kpi, setKpi] = useState<KPIData>({ income: 0, expenses: 0, investments: 0, netSavings: 0, savingsRate: 0 });
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>([]);

  const navigate = useNavigate();
  const { household } = useHousehold();

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchReportData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { start, end } = getPeriodRange(period, anchor);

      // Calculate previous period range
      const prevAnchor = navigateAnchor("prev", period, anchor);
      const { start: prevStart, end: prevEnd } = getPeriodRange(period, prevAnchor);

      // Get household id if family scope
      let householdId: string | null = null;
      if (scope === "family") {
        const { data: membership } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .single();
        householdId = membership?.household_id || null;
      }

      const buildQuery = (start: Date, end: Date) => {
        let q = supabase
          .from("transactions")
          .select("id, type, amount, category, transaction_date, payment_method, remarks")
          .gte("transaction_date", fmtDate(start))
          .lte("transaction_date", fmtDate(end));

        if (scope === "individual") {
          q = q.eq("user_id", user.id).is("household_id", null);
        } else {
          q = q.eq("household_id", householdId);
        }
        return q;
      };

      const [{ data: currData }, { data: prevData }] = await Promise.all([
        buildQuery(start, end),
        buildQuery(prevStart, prevEnd),
      ]);

      const curr = (currData || []) as Transaction[];
      const prev = (prevData || []) as Transaction[];

      setKpi(buildKPI(curr, prev));
      setTrendPoints(buildTrendPoints(period, anchor, curr));
      const { rows, total } = buildCategoryRows(curr, prev);
      setCategoryRows(rows);
      setTotalExpenses(total);
      setCurrentTransactions(curr);
    } catch (err) {
      console.error("Error fetching report data:", err);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [user, scope, period, anchor]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-[hsl(222,47%,11%)] text-white shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                <WalletIcon className="h-5 w-5 text-white" />
              </div>
              <div className="hidden md:block">
                <h1 className="text-xl font-bold">MyFinanceHub</h1>
                <p className="text-xs text-white/70">Expense Reports</p>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10 mx-2 hidden md:block" />
            <HouseholdSwitcher />
          </div>

          <div className="flex gap-1 md:gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/dashboard")} title="Dashboard">
              <WalletIcon className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/budget-planning")} title="Budget Planning">
              <CalendarDays className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/goal-allocation")} title="Goal Allocation">
              <Target className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/household-settings")} title="Family Settings">
              <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 text-white hover:bg-white/10 hover:text-white" onClick={handleSignOut} title="Sign Out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Page title + period/scope controls */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-primary" />
              Expense Reports
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Review your spending trends and identify areas to improve
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <ReportPeriodSelector
              period={period}
              onPeriodChange={(p) => { setPeriod(p); }}
              anchor={anchor}
              onAnchorChange={setAnchor}
            />

            {/* Scope toggle */}
            <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
              {(["individual", "family"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                    scope === s
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <ReportKPIRow data={kpi} loading={loading} />

        {/* Trend Chart + Category Breakdown side-by-side on large screens */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Trend Chart — wider */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Spending Trend</CardTitle>
              <CardDescription>
                {getPeriodLabel(period, anchor)} — income vs expenses over sub-periods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReportTrendChart data={trendPoints} period={period} loading={loading} />
            </CardContent>
          </Card>

          {/* Category Breakdown — narrower */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Category Breakdown</CardTitle>
              <CardDescription>Ranked by spend · ▲▼ vs previous period</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[380px] overflow-y-auto pr-1">
              <ReportCategoryBreakdown
                data={categoryRows}
                totalExpenses={totalExpenses}
                loading={loading}
              />
            </CardContent>
          </Card>
        </div>

        {/* Insight Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">💡 Smart Insights</CardTitle>
            <CardDescription>
              Personalised observations on your spending — what's in control and what can be improved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportInsightCards
              categories={categoryRows}
              totalExpenses={totalExpenses}
              totalIncome={kpi.income}
              savingsRate={kpi.savingsRate}
              loading={loading}
            />
          </CardContent>
        </Card>

        {/* Top Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Expense Categories to Control</CardTitle>
            <CardDescription>Discretionary expenses with the highest impact on your budget · Click a category to see transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <TopControlTable rows={categoryRows} loading={loading} transactions={currentTransactions} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

// ── Inline sub-component: Improvement-focused table ──────────────────────────
import { CONTROLLABLE_CATEGORIES } from "@/lib/constants";
import { format as fmtFns } from "date-fns";

const TopControlTable = ({
  rows,
  loading,
  transactions,
}: {
  rows: CategoryRow[];
  loading: boolean;
  transactions: Transaction[];
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const discretionary = rows
    .filter((r) => CONTROLLABLE_CATEGORIES[r.category] === "discretionary")
    .sort((a, b) => b.amount - a.amount);

  if (!discretionary.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No discretionary expenses found for this period.
      </p>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  // Group individual transactions by category (expenses only, no Credit Card Bill)
  const txnsByCategory: Record<string, Transaction[]> = {};
  transactions
    .filter((t) => t.type === "expense" && t.category !== "Credit Card Bill")
    .forEach((t) => {
      if (!txnsByCategory[t.category]) txnsByCategory[t.category] = [];
      txnsByCategory[t.category].push(t);
    });
  // Sort each category's transactions by date descending
  Object.values(txnsByCategory).forEach((arr) =>
    arr.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
  );

  return (
    <div className="space-y-0 divide-y divide-border">
      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span />
        <span>Category</span>
        <span className="text-right">Spent</span>
        <span className="text-right">vs Last Period</span>
        <span className="text-right">Potential Saving</span>
      </div>
      {discretionary.map((r) => {
        const delta = r.prevAmount ? r.amount - r.prevAmount : undefined;
        const potentialSaving = r.amount * 0.2;
        const isExpanded = expandedCategories.has(r.category);
        const catTxns = txnsByCategory[r.category] || [];

        return (
          <div key={r.category}>
            {/* Category summary row — clickable */}
            <button
              type="button"
              onClick={() => toggleCategory(r.category)}
              className="w-full grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 py-3 items-center text-sm text-left hover:bg-muted/50 rounded-md px-1 transition-colors duration-150 group"
            >
              {/* Chevron */}
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {isExpanded
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
              </span>
              {/* Category name */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                <span className="font-medium">{r.category}</span>
                {catTxns.length > 0 && (
                  <span className="text-xs text-muted-foreground">({catTxns.length} txn{catTxns.length !== 1 ? "s" : ""})</span>
                )}
              </div>
              {/* Spent */}
              <span className="text-right font-semibold text-destructive tabular-nums">
                {fmt(r.amount)}
              </span>
              {/* vs last period */}
              <span className="text-right tabular-nums">
                {delta !== undefined ? (
                  <span className={delta > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                    {delta > 0 ? "+" : ""}{fmt(delta)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
              {/* Potential saving */}
              <span className="text-right text-muted-foreground tabular-nums text-xs">
                Save ~{fmt(potentialSaving)} by cutting 20%
              </span>
            </button>

            {/* Expanded transaction list */}
            {isExpanded && (
              <div className="mx-1 mb-2 rounded-lg border border-border bg-muted/30 overflow-hidden">
                {catTxns.length === 0 ? (
                  <p className="py-3 px-4 text-xs text-muted-foreground text-center">
                    No individual transactions recorded for this category.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {/* Sub-header */}
                    <div className="grid grid-cols-[1fr_2fr_auto] gap-3 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                      <span>Date</span>
                      <span>Remarks</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {catTxns.map((t) => (
                      <div
                        key={t.id}
                        className="grid grid-cols-[1fr_2fr_auto] gap-3 px-4 py-2.5 items-center text-xs hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-muted-foreground tabular-nums">
                          {fmtFns(new Date(t.transaction_date), "d MMM yyyy")}
                        </span>
                        <span className="truncate flex items-center gap-1.5">
                          {t.remarks ? (
                            <>
                              <Receipt className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{t.remarks}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">No remarks</span>
                          )}
                        </span>
                        <span className="text-right font-semibold text-destructive tabular-nums">
                          {fmt(Number(t.amount))}
                        </span>
                      </div>
                    ))}
                    {/* Category subtotal */}
                    <div className="grid grid-cols-[1fr_2fr_auto] gap-3 px-4 py-2 bg-muted/60">
                      <span className="text-xs font-semibold text-muted-foreground col-span-2">Total</span>
                      <span className="text-right text-xs font-bold text-destructive tabular-nums">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Reports;
