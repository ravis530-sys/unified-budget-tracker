import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { calculateCarryForward, calculateTotalGlobalCarryForward } from "@/lib/budgetUtils";

interface BudgetSummaryProps {
  selectedMonth: Date;
  scope: "individual" | "family";
}

const BudgetSummary = ({ selectedMonth, scope }: BudgetSummaryProps) => {
  const [summary, setSummary] = useState({
    plannedIncome: 0,
    plannedExpenses: 0,
    actualIncome: 0,
    actualExpenses: 0,
    previousBalance: 0,
    previousPlannedIncome: 0,
    previousPlannedExpenses: 0,
    carryForwardAmount: 0, // New field to track carry-forward separately
  });

  useEffect(() => {
    fetchSummary();
  }, [selectedMonth, scope]);

  const fetchSummary = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const prevMonthStart = startOfMonth(subMonths(selectedMonth, 1));
      const prevMonthEnd = endOfMonth(subMonths(selectedMonth, 1));

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

      // Fetch planned budgets
      let budgetQuery = supabase
        .from("monthly_budgets")
        .select("type, planned_amount, category")
        .eq("month_year", monthStart.toISOString().split('T')[0]);

      if (scope === "individual") {
        budgetQuery = budgetQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        budgetQuery = budgetQuery.eq("household_id", householdId);
      }

      const { data: budgets } = await budgetQuery;

      // Fetch actual transactions for current month
      let transactionQuery = supabase
        .from("transactions")
        .select("type, amount")
        .gte("transaction_date", monthStart.toISOString())
        .lte("transaction_date", monthEnd.toISOString());

      if (scope === "individual") {
        transactionQuery = transactionQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        transactionQuery = transactionQuery.eq("household_id", householdId);
      }

      const { data: transactions } = await transactionQuery;

      // Fetch previous month transactions for carry forward
      let prevTransactionQuery = supabase
        .from("transactions")
        .select("type, amount")
        .gte("transaction_date", prevMonthStart.toISOString())
        .lte("transaction_date", prevMonthEnd.toISOString());

      if (scope === "individual") {
        prevTransactionQuery = prevTransactionQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        prevTransactionQuery = prevTransactionQuery.eq("household_id", householdId);
      }

      const { data: prevTransactions } = await prevTransactionQuery;

      // Fetch previous month budgets
      const { data: prevBudgets } = await supabase
        .from("monthly_budgets")
        .select("type, planned_amount")
        .eq("user_id", user.id)
        .eq("month_year", prevMonthStart.toISOString().split('T')[0]);

      let plannedIncome = budgets
        ?.filter((b) => b.type === "income")
        .reduce((sum, b) => sum + Number(b.planned_amount), 0) || 0;

      const plannedExpenses = budgets
        ?.filter((b) => b.type === "expense")
        .reduce((sum, b) => sum + Number(b.planned_amount), 0) || 0;

      const actualIncome = transactions
        ?.filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const actualExpenses = transactions
        ?.filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Calculate global carry forward using the new utility function
      // This sums up ALL previous income transactions minus ALL previous allocations
      // regardless of whether there are budgets for the current month
      const totalCarryForward = await calculateTotalGlobalCarryForward(user.id, selectedMonth, householdId);
      console.log(`Total Global Carry-forward:`, totalCarryForward);

      // Carry forward is the sum of all category carry-forwards
      const previousBalance = totalCarryForward;

      console.log("Total carry-forward:", totalCarryForward);

      // Add carry forward to planned income
      plannedIncome += totalCarryForward;

      console.log("Planned income before carry-forward:", plannedIncome - totalCarryForward);
      console.log("Carry-forward added:", totalCarryForward);
      console.log("Total planned income:", plannedIncome);

      const prevPlannedIncome = prevBudgets
        ?.filter((b) => b.type === "income")
        .reduce((sum, b) => sum + Number(b.planned_amount), 0) || 0;

      const prevPlannedExpenses = prevBudgets
        ?.filter((b) => b.type === "expense")
        .reduce((sum, b) => sum + Number(b.planned_amount), 0) || 0;

      setSummary({
        plannedIncome,
        plannedExpenses,
        actualIncome,
        actualExpenses,
        previousBalance,
        previousPlannedIncome: prevPlannedIncome,
        previousPlannedExpenses: prevPlannedExpenses,
        carryForwardAmount: totalCarryForward, // Store carry-forward amount
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const availableBalance = summary.previousBalance + summary.actualIncome - summary.actualExpenses;
  const plannedBalance = summary.plannedIncome - summary.plannedExpenses;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Carry Forward</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ₹{summary.previousBalance.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Accumulated Balance
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Planned Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            ₹{summary.plannedIncome.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Actual: ₹{summary.actualIncome.toLocaleString()}
          </p>
          {summary.carryForwardAmount > 0 && (
            <p className="text-xs text-green-600 mt-1">
              Includes ₹{summary.carryForwardAmount.toLocaleString()} carry forward
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Planned Expenses</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            ₹{summary.plannedExpenses.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Actual: ₹{summary.actualExpenses.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${availableBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{availableBalance.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Planned: ₹{plannedBalance.toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetSummary;
