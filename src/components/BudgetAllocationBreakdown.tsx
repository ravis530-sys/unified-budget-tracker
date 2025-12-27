import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { startOfMonth, endOfMonth, format } from "date-fns";

interface BudgetAllocation {
  category: string;
  planned: number;
  actual: number;
}

interface BudgetAllocationBreakdownProps {
  selectedMonth: Date;
  type: "income" | "expense";
  scope: "individual" | "family";
}

const BudgetAllocationBreakdown = ({ selectedMonth, type, scope }: BudgetAllocationBreakdownProps) => {
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllocations();
  }, [selectedMonth, type, scope]);

  const fetchAllocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

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

      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

      // Fetch budgets query
      let budgetQuery = supabase
        .from("monthly_budgets")
        .select("category, planned_amount, start_date, end_date")
        .eq("type", type)
        .lte("start_date", monthEndStr);

      if (scope === "individual") {
        budgetQuery = budgetQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        budgetQuery = budgetQuery.eq("household_id", householdId);
      }

      const { data: rawBudgets } = await budgetQuery;

      // Filter for overlap in client
      const budgets = (rawBudgets || []).filter(budget => {
        if (!budget.end_date) return true;
        return budget.end_date >= monthStartStr;
      });

      // Fetch actual transactions
      let transactionQuery = supabase
        .from("transactions")
        .select("category, amount")
        .eq("type", type)
        .gte("transaction_date", monthStart.toISOString())
        .lte("transaction_date", monthEnd.toISOString());

      if (scope === "individual") {
        transactionQuery = transactionQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        transactionQuery = transactionQuery.eq("household_id", householdId);
      }

      const { data: transactions } = await transactionQuery;

      // Combine budgets with actuals
      const allocationMap = new Map<string, BudgetAllocation>();

      budgets?.forEach((budget) => {
        allocationMap.set(budget.category, {
          category: budget.category,
          planned: Number(budget.planned_amount),
          actual: 0,
        });
      });

      transactions?.forEach((transaction) => {
        const existing = allocationMap.get(transaction.category);
        if (existing) {
          existing.actual += Number(transaction.amount);
        } else {
          allocationMap.set(transaction.category, {
            category: transaction.category,
            planned: 0,
            actual: Number(transaction.amount),
          });
        }
      });

      setAllocations(Array.from(allocationMap.values()));
    } catch (error) {
      console.error("Error fetching allocations:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (allocations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No {type} allocations for this month
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allocations.map((allocation) => {
        const percentage = allocation.planned > 0
          ? (allocation.actual / allocation.planned) * 100
          : 0;
        const isOverBudget = allocation.actual > allocation.planned && allocation.planned > 0;
        const remaining = allocation.planned - allocation.actual;

        return (
          <div key={allocation.category} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{allocation.category}</p>
                <p className="text-sm text-muted-foreground">
                  ₹{allocation.actual.toLocaleString()} / ₹{allocation.planned.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${isOverBudget ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {allocation.planned > 0 ? `${percentage.toFixed(0)}%` : 'No budget'}
                </p>
                {allocation.planned > 0 && (
                  <p className={`text-xs ${isOverBudget ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {isOverBudget ? `Over by ₹${Math.abs(remaining).toLocaleString()}` : `₹${remaining.toLocaleString()} left`}
                  </p>
                )}
              </div>
            </div>
            {allocation.planned > 0 && (
              <Progress
                value={Math.min(percentage, 100)}
                className={isOverBudget ? 'bg-red-100' : ''}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BudgetAllocationBreakdown;
