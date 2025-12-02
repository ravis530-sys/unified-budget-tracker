import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface Stats {
  totalEarnings: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number;
}

interface DashboardStatsProps {
  scope: "individual" | "family";
}

const DashboardStats = ({ scope }: DashboardStatsProps) => {
  const [stats, setStats] = useState<Stats>({
    totalEarnings: 0,
    totalExpenses: 0,
    netBalance: 0,
    savingsRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [scope]);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Current month for expenses
      const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const currentMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // Previous month for earnings
      const previousMonth = subMonths(new Date(), 1);
      const previousMonthStart = format(startOfMonth(previousMonth), "yyyy-MM-dd");
      const previousMonthEnd = format(endOfMonth(previousMonth), "yyyy-MM-dd");

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

      // Fetch earnings from previous month
      let earningsQuery = supabase
        .from("transactions")
        .select("amount")
        .eq("type", "income")
        .gte("transaction_date", previousMonthStart)
        .lte("transaction_date", previousMonthEnd);

      if (scope === "individual") {
        earningsQuery = earningsQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        earningsQuery = earningsQuery.eq("household_id", householdId);
      }

      const { data: earnings } = await earningsQuery;

      // Fetch expenses from current month
      let expensesQuery = supabase
        .from("transactions")
        .select("amount")
        .eq("type", "expense")
        .gte("transaction_date", currentMonthStart)
        .lte("transaction_date", currentMonthEnd);

      if (scope === "individual") {
        expensesQuery = expensesQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        expensesQuery = expensesQuery.eq("household_id", householdId);
      }

      const { data: expenses } = await expensesQuery;

      const totalEarnings = earnings?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const netBalance = totalEarnings - totalExpenses;
      const savingsRate = totalEarnings > 0 ? (netBalance / totalEarnings) * 100 : 0;

      setStats({
        totalEarnings,
        totalExpenses,
        netBalance,
        savingsRate,
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
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Earnings
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            {formatCurrency(stats.totalEarnings)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Previous month</p>
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
            Net Balance
          </CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.netBalance >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(stats.netBalance)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Earnings - Expenses</p>
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
          <p className="text-xs text-muted-foreground mt-1">Of total earnings</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
