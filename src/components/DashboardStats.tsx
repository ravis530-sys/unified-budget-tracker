import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, DollarSign, TrendingUpDown, ChevronDown, ChevronUp, ArrowRight, ArrowLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

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

      // Fetch ALL expenses from previous months (strictly before selected month)
      let previousExpensesQuery = supabase
        .from("transactions")
        .select("amount")
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
      const totalPreviousExpenses = previousExpenses?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalPreviousInvestments = previousInvestments?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Total Saved = Total Previous Earnings - Total Previous Expenses - Total Previous Investments
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(stats.netBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Actual available cash</p>
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
    </div>
  );
};

export default DashboardStats;
