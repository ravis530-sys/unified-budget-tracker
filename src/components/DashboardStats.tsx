import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, DollarSign, TrendingUpDown, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Scale, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORIES, INVESTMENT_CATEGORIES } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Stats {
  accumulatedSavings: number;
  currentEarnings: number;
  totalExpenses: number;
  creditCardExpenses: number;
  totalInvestments: number;
  netBalance: number;
  savingsRate: number;
  allocatedAmount: number;
  savedForNextMonth: number;
  utilizedExpenses: number;
}

interface DashboardStatsProps {
  scope: "individual" | "family";
  selectedMonth?: Date;
}

const DashboardStats = ({ scope, selectedMonth = new Date() }: DashboardStatsProps) => {
  const [stats, setStats] = useState<Stats>({
    accumulatedSavings: 0,
    currentEarnings: 0,
    totalExpenses: 0,
    creditCardExpenses: 0,
    totalInvestments: 0,
    netBalance: 0,
    savingsRate: 0,
    allocatedAmount: 0,
    savedForNextMonth: 0,
    utilizedExpenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showAllocations, setShowAllocations] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showSquareOffDialog, setShowSquareOffDialog] = useState(false);
  const [squareOffCategory, setSquareOffCategory] = useState<string>("Square Off / Retained Savings");
  const [squareOffTxnType, setSquareOffTxnType] = useState<"expense" | "investment">("expense");
  const [squareOffLoading, setSquareOffLoading] = useState(false);

  useEffect(() => {
    fetchStats();

    // Set up real-time subscription for transactions
    const channel = supabase
      .channel('dashboard-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'transactions'
        },
        () => {
          // Refetch stats when any transaction changes
          fetchStats();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [scope, selectedMonth]);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Current month (selected month) for expenses
      const currentMonthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const currentMonthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      // Get household context for family scope
      let householdId: string | null = null;
      if (scope === "family") {
        const { data: membership } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .single();
        householdId = membership?.household_id || null;
      }
      setHouseholdId(householdId);

      // Fetch ALL earnings from previous months (strictly before selected month)
      let earningsQuery = supabase
        .from("transactions")
        .select("amount")
        .eq("type", "income")
        .lt("transaction_date", currentMonthStart);

      if (scope === "individual") {
        earningsQuery = earningsQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        earningsQuery = earningsQuery.eq("household_id", householdId);
      }

      const { data: earnings } = await earningsQuery;

      // Fetch ALL expenses from previous months (strictly before selected month, excluding Credit Card Bill to prevent double counting)
      let previousExpensesQuery = supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "expense")
        .lt("transaction_date", currentMonthStart);

      if (scope === "individual") {
        previousExpensesQuery = previousExpensesQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        previousExpensesQuery = previousExpensesQuery.eq("household_id", householdId);
      }

      const { data: previousExpenses } = await previousExpensesQuery;

      // Fetch expenses from selected month
      let currentExpensesQuery = supabase
        .from("transactions")
        .select("amount, category, payment_method")
        .eq("type", "expense")
        .gte("transaction_date", currentMonthStart)
        .lte("transaction_date", currentMonthEnd);

      if (scope === "individual") {
        currentExpensesQuery = currentExpensesQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        currentExpensesQuery = currentExpensesQuery.eq("household_id", householdId);
      }

      const { data: currentExpenses } = await currentExpensesQuery;

      // Fetch current month earnings
      let currentEarningsQuery = supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "income")
        .gte("transaction_date", currentMonthStart)
        .lte("transaction_date", currentMonthEnd);

      if (scope === "individual") {
        currentEarningsQuery = currentEarningsQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        currentEarningsQuery = currentEarningsQuery.eq("household_id", householdId);
      }

      const { data: currentEarningsData } = await currentEarningsQuery;

      // Fetch ALL investments from previous months (strictly before selected month)
      let previousInvestmentsQuery = supabase
        .from("transactions")
        .select("amount")
        .eq("type", "investment")
        .lt("transaction_date", currentMonthStart);

      if (scope === "individual") {
        previousInvestmentsQuery = previousInvestmentsQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        previousInvestmentsQuery = previousInvestmentsQuery.eq("household_id", householdId);
      }

      const { data: previousInvestments } = await previousInvestmentsQuery;

      // Fetch current month investments
      let currentInvestmentsQuery = supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "investment")
        .gte("transaction_date", currentMonthStart)
        .lte("transaction_date", currentMonthEnd);

      if (scope === "individual") {
        currentInvestmentsQuery = currentInvestmentsQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        currentInvestmentsQuery = currentInvestmentsQuery.eq("household_id", householdId);
      }

      const { data: currentInvestments } = await currentInvestmentsQuery;

      // Fetch current month allocations
      const currentAllocMonthStr = format(startOfMonth(selectedMonth), "yyyy-MM-01");
      const { data: currentAllocationsList } = await supabase
        .from("budget_allocations")
        .select(`
          allocated_amount,
          income_budget:monthly_budgets!fk_income_budget(household_id, category),
          expense_budget:monthly_budgets!fk_expense_budget(category)
        `)
        .eq("month_year", currentAllocMonthStr);

      let totalAllocated = 0;
      const allocatedIncomeMap: Record<string, number> = {};
      const allocatedExpenseMap: Record<string, number> = {};

      const filteredAllocations = currentAllocationsList?.filter((alloc: any) => {
        if (scope === "individual") {
          return !alloc.income_budget?.household_id;
        } else {
          return alloc.income_budget?.household_id === householdId;
        }
      }) || [];

      filteredAllocations.forEach((alloc: any) => {
        const amt = Number(alloc.allocated_amount);
        totalAllocated += amt;

        if (alloc.income_budget?.category) {
            allocatedIncomeMap[alloc.income_budget.category] = (allocatedIncomeMap[alloc.income_budget.category] || 0) + amt;
        }
        if (alloc.expense_budget?.category) {
            allocatedExpenseMap[alloc.expense_budget.category] = (allocatedExpenseMap[alloc.expense_budget.category] || 0) + amt;
        }
      });


      const totalPreviousEarnings = earnings?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalPreviousExpenses = previousExpenses
        ?.filter((t: any) => t.category !== "Credit Card Bill")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalPreviousInvestments = previousInvestments?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Total Saved = Total Previous Earnings - Total Previous Expenses (excl. CC Bill) - Total Previous Investments
      const totalSaved = totalPreviousEarnings - totalPreviousExpenses - totalPreviousInvestments;

      // Actual totals for Net Balance (excludes Credit Card Bill category to avoid double-counting)
      const totalCurrentExpensesActual = currentExpenses
        ?.filter((t: any) => t.category !== "Credit Card Bill")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalCurrentEarningsActual = currentEarningsData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalCurrentInvestments = currentInvestments?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Credit card expenses recorded with payment_method="creditcard" (deferred, paid later)
      const currentCreditCardExpenses = currentExpenses
        ?.filter((t: any) => t.payment_method === "creditcard")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Credit Card Bill payments made this month (category="Credit Card Bill", paid via UPI/bank)
      // These represent actual settlement of prior CC spends
      const currentCreditCardPayments = currentExpenses
        ?.filter((t: any) => t.category === "Credit Card Bill" && t.payment_method !== "creditcard")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Outstanding CC balance = total CC spends this month minus what's already been paid off
      const outstandingCreditCard = Math.max(0, currentCreditCardExpenses - currentCreditCardPayments);

      // Calculate category-level Unallocated Earnings
      let totalCurrentEarningsUnalloc = 0;
      const incomeTxnMap: Record<string, number> = {};
      currentEarningsData?.forEach(txn => {
          incomeTxnMap[txn.category] = (incomeTxnMap[txn.category] || 0) + Number(txn.amount);
      });
      Object.entries(incomeTxnMap).forEach(([cat, amt]) => {
          const allocated = allocatedIncomeMap[cat] || 0;
          totalCurrentEarningsUnalloc += Math.max(0, amt - allocated);
      });

      // Calculate category-level Unallocated Expenses (Only non-CC expenses to prevent duplication with CC Outstanding)
      let totalCurrentExpensesUnalloc = 0;
      const expenseTxnMap: Record<string, number> = {};
      const nonCcExpenseTxnMap: Record<string, number> = {};
      
      currentExpenses?.forEach(txn => {
          const amt = Number(txn.amount);
          expenseTxnMap[txn.category] = (expenseTxnMap[txn.category] || 0) + amt;
          if (txn.payment_method !== "creditcard") {
              nonCcExpenseTxnMap[txn.category] = (nonCcExpenseTxnMap[txn.category] || 0) + amt;
          }
      });
      
      Object.entries(nonCcExpenseTxnMap).forEach(([cat, nonCcAmt]) => {
          const allocated = allocatedExpenseMap[cat] || 0;
          totalCurrentExpensesUnalloc += Math.max(0, nonCcAmt - allocated);
      });

      // Build investment transaction map (for investment allocations like MF, SIP etc.)
      const investmentTxnMap: Record<string, number> = {};
      currentInvestments?.forEach((txn: any) => {
          investmentTxnMap[txn.category] = (investmentTxnMap[txn.category] || 0) + Number(txn.amount);
      });

      // Calculate unutilized allocations (Allocated - actual spend per allocated category)
      // Uses both expense AND investment transaction maps to handle investment-type allocations
      let unutilizedAllocated = 0;
      Object.entries(allocatedExpenseMap).forEach(([cat, allocatedAmt]) => {
          const spentAmt = (expenseTxnMap[cat] || 0) + (investmentTxnMap[cat] || 0);
          unutilizedAllocated += Math.max(0, allocatedAmt - spentAmt);
      });

      // Utilized = total allocated minus what's still unspent
      const utilizedExpenses = totalAllocated - unutilizedAllocated;

      // Remaining from allocated SOURCE earnings only (not all income)
      // e.g. Salary earned 183505, allocated 180000 → remaining = 3505
      let remainingAllocatedSourceEarnings = 0;
      Object.entries(allocatedIncomeMap).forEach(([cat, allocatedFromCat]) => {
          const earnedInCat = incomeTxnMap[cat] || 0;
          remainingAllocatedSourceEarnings += Math.max(0, earnedInCat - allocatedFromCat);
      });

      // Saved For Next Month = remaining allocated source earnings + unutilized goal allocations
      const savedForNextMonth = remainingAllocatedSourceEarnings + unutilizedAllocated;

      // Net Balance = Total Saved + Current Month Earnings - All Current Expenses (excl. CC Bill) - Investments
      // totalCurrentExpensesActual already includes CC spends (real liability) but excludes the CC Bill payment
      // category (which would double-count the CC obligation already captured by the CC spend entries).
      const netBalance = totalSaved + totalCurrentEarningsActual - totalCurrentExpensesActual - totalCurrentInvestments;

      // Savings Rate = (Net Balance / (Total Saved + Current Earnings)) * 100 (percentage of total available funds remaining)
      const totalAvailable = totalSaved + totalCurrentEarningsActual;
      const savingsRate = totalAvailable > 0 ? (netBalance / totalAvailable) * 100 : 0;

      const expensesByPaymentMethod: Record<string, number> = {};
      currentExpenses?.forEach(txn => {
          const method = txn.payment_method || 'unknown';
          expensesByPaymentMethod[method] = (expensesByPaymentMethod[method] || 0) + Number(txn.amount);
      });

      console.log("=== Debug: Dashboard Stats ===", {
        totalExpenses: {
          finalValue: totalCurrentExpensesActual,
          totalCurrentExpensesActual,
          expensesByPaymentMethod,
          expenseTxnMap,
          nonCcExpenseTxnMap,
          allocatedExpenseMap,
        },
        monthEarnings: {
          finalValue: totalCurrentEarningsUnalloc,
          totalCurrentEarningsActual,
          incomeTxnMap,
          allocatedIncomeMap,
        },
        ccOutstanding: {
          finalValue: outstandingCreditCard,
          currentCreditCardExpenses,
          currentCreditCardPayments,
        },
        netBalance: {
          finalValue: netBalance,
          totalSaved,
          totalCurrentEarningsActual,
          totalCurrentExpensesActual,
          outstandingCreditCard,
          totalCurrentInvestments,
          formula: "totalSaved + totalCurrentEarningsActual - totalCurrentExpensesActual - totalCurrentInvestments"
        },
        totalInvestments: {
          finalValue: totalCurrentInvestments,
          investmentTxnMap,
        }
      });

      setStats({
        accumulatedSavings: totalSaved,
        currentEarnings: totalCurrentEarningsUnalloc,
        totalExpenses: totalCurrentExpensesActual,
        creditCardExpenses: outstandingCreditCard,
        totalInvestments: totalCurrentInvestments,
        netBalance,
        savingsRate,
        allocatedAmount: totalAllocated,
        savedForNextMonth,
        utilizedExpenses,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const handleSquareOff = async () => {
    try {
      setSquareOffLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const lastDayOfMonth = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthLabel = format(selectedMonth, "MMMM yyyy");

      if (stats.netBalance > 0) {
        // Record closing transaction for remaining positive balance
        const { error } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            household_id: scope === "family" ? householdId : null,
            amount: stats.netBalance,
            type: squareOffTxnType,
            category: squareOffCategory,
            transaction_date: lastDayOfMonth,
            remarks: `Square Off remaining balance for ${monthLabel}`,
            payment_method: "cash",
            interval: "one-time",
            tag: "Square Off",
            currency: "INR"
          });

        if (error) throw error;
      } else if (stats.netBalance < 0) {
        // Record balancing income adjustment for deficit
        const { error } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            household_id: scope === "family" ? householdId : null,
            amount: Math.abs(stats.netBalance),
            type: "income",
            category: "Square Off Deficit Adjustment",
            transaction_date: lastDayOfMonth,
            remarks: `Square Off deficit adjustment for ${monthLabel}`,
            payment_method: "cash",
            interval: "one-time",
            tag: "Square Off",
            currency: "INR"
          });

        if (error) throw error;
      }

      toast.success(`Successfully squared off Net Balance for ${monthLabel}!`);
      setShowSquareOffDialog(false);
      fetchStats();
    } catch (error: any) {
      console.error("Error squaring off Net Balance:", error);
      toast.error("Failed to square off: " + (error.message || "Unknown error"));
    } finally {
      setSquareOffLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Saved
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.accumulatedSavings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Accumulated (Prev Months)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Month Earnings
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.currentEarnings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unallocated this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Investments
            </CardTitle>
            <TrendingUpDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats.totalInvestments)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={`text-2xl font-bold ${stats.netBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(stats.netBalance)}
            </div>
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
              <p className="text-xs text-muted-foreground">Actual cash</p>
              {stats.netBalance !== 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] font-medium gap-1 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-xs"
                  onClick={() => setShowSquareOffDialog(true)}
                  title="Square off remaining balance so it does not carry forward to next month"
                >
                  <Scale className="h-3 w-3" />
                  Square Off
                </Button>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 h-5 bg-muted/60 text-muted-foreground flex items-center gap-1 border-border">
                  <CheckCircle2 className="h-2.5 w-2.5 text-green-500" /> Squared Off
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Savings Rate
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {stats.savingsRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Of total saved</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer select-none py-4 px-6 hover:bg-muted/40 transition-colors rounded-t-xl"
          onClick={() => setShowAllocations(!showAllocations)}
        >
          <div>
            <CardTitle className="text-base font-semibold">Advanced Allocation Tracking</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Breakdown of allocated vs. utilized funds</p>
          </div>
          {showAllocations ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>

        {showAllocations && (
          <CardContent className="px-6 pb-6 pt-0">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border bg-muted/20 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Allocated Earnings</CardTitle>
                  <ArrowLeft className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{formatCurrency(stats.allocatedAmount)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Assigned to goals</p>
                </CardContent>
              </Card>

              <Card className="border bg-muted/20 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Utilized Expenses</CardTitle>
                  <ArrowRight className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.utilizedExpenses)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Actual spend from allocated goals</p>
                </CardContent>
              </Card>

              <Card className="border bg-muted/20 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Saved For Next Month</CardTitle>
                  <PiggyBank className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.savedForNextMonth)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Remaining source &amp; unutilized goals</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Square Off Net Balance Dialog */}
      <Dialog open={showSquareOffDialog} onOpenChange={setShowSquareOffDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5 text-primary" />
              Square Off Remaining Balance
            </DialogTitle>
            <DialogDescription>
              Settle remaining Net Balance for {format(selectedMonth, "MMMM yyyy")} so that it does not carry forward into {format(addMonths(selectedMonth, 1), "MMMM yyyy")}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className={`p-4 rounded-lg border flex items-center justify-between ${
              stats.netBalance >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
            }`}>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Net Balance to Square Off</p>
                <p className={`text-2xl font-bold ${
                  stats.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {stats.netBalance > 0 ? "+" : ""}{formatCurrency(stats.netBalance)}
                </p>
              </div>
              <Badge variant="outline" className={stats.netBalance >= 0 ? "border-emerald-500/30 text-emerald-600" : "border-rose-500/30 text-rose-600"}>
                {stats.netBalance >= 0 ? "Positive Surplus" : "Negative Deficit"}
              </Badge>
            </div>

            {stats.netBalance > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Recording a square-off transaction on <strong>{format(endOfMonth(selectedMonth), "MMM dd, yyyy")}</strong> will bring {format(selectedMonth, "MMMM yyyy")}&apos;s ending balance to <strong>₹0</strong>, preventing it from carrying forward as saved funds into {format(addMonths(selectedMonth, 1), "MMMM yyyy")}.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Destination Category</Label>
                  <Select value={squareOffCategory} onValueChange={(val) => {
                    setSquareOffCategory(val);
                    if (INVESTMENT_CATEGORIES.includes(val)) {
                      setSquareOffTxnType("investment");
                    } else {
                      setSquareOffTxnType("expense");
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Square Off / Retained Savings">
                        🎯 Square Off / Retained Savings (Recommended)
                      </SelectItem>
                      <SelectItem value="Savings">Savings</SelectItem>
                      <SelectItem value="Emergency Fund">Emergency Fund</SelectItem>
                      <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                      {EXPENSE_CATEGORIES.filter(c => !["Savings", "Emergency Fund", "Miscellaneous"].includes(c)).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      {INVESTMENT_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c} (Investment)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    A transaction with tag &quot;Square Off&quot; will be created in this category.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Recording a balancing income adjustment on <strong>{format(endOfMonth(selectedMonth), "MMM dd, yyyy")}</strong> will neutralize this deficit of <strong>{formatCurrency(Math.abs(stats.netBalance))}</strong>, ensuring {format(addMonths(selectedMonth, 1), "MMMM yyyy")} starts fresh at ₹0 instead of in negative territory.
                </p>
                <div className="p-3 bg-muted/40 rounded border text-xs text-muted-foreground">
                  An adjustment transaction tagged &quot;Square Off&quot; under category <strong>Square Off Deficit Adjustment</strong> will be added.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSquareOffDialog(false)} disabled={squareOffLoading}>
              Cancel
            </Button>
            <Button onClick={handleSquareOff} disabled={squareOffLoading} className="gap-2">
              {squareOffLoading ? "Squaring Off..." : "Confirm & Square Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardStats;
