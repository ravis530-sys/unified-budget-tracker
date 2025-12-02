import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startOfMonth } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface IncomeBudget {
  id: string;
  category: string;
  plannedAmount: number;
  allocated: number;
}

interface ExpenseBudget {
  id: string;
  category: string;
  plannedAmount: number;
}

interface Allocation {
  id?: string;
  incomeId: string;
  incomeCategory: string;
  amount: number;
}

interface ExpenseAllocation {
  expense: ExpenseBudget;
  allocations: Allocation[];
}

interface BudgetIncomeAllocationProps {
  selectedMonth: Date;
  onUpdate?: () => void;
  scope: "individual" | "family";
}

const BudgetIncomeAllocation = ({ selectedMonth, onUpdate, scope }: BudgetIncomeAllocationProps) => {
  const [incomeBudgets, setIncomeBudgets] = useState<IncomeBudget[]>([]);
  const [expenseAllocations, setExpenseAllocations] = useState<ExpenseAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, scope]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(selectedMonth);
      const monthKey = monthStart.toISOString().split('T')[0];

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

      // Fetch income budgets
      let incomeQuery = supabase
        .from("monthly_budgets")
        .select("id, category, planned_amount")
        .eq("type", "income")
        .eq("month_year", monthKey);

      if (scope === "individual") {
        incomeQuery = incomeQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        incomeQuery = incomeQuery.eq("household_id", householdId);
      }

      const { data: incomeData } = await incomeQuery;

      // Fetch expense budgets
      let expenseQuery = supabase
        .from("monthly_budgets")
        .select("id, category, planned_amount")
        .eq("type", "expense")
        .eq("month_year", monthKey);

      if (scope === "individual") {
        expenseQuery = expenseQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        expenseQuery = expenseQuery.eq("household_id", householdId);
      }

      const { data: expenseData } = await expenseQuery;

      // Fetch existing allocations
      const { data: allocationsData } = await supabase
        .from("budget_allocations")
        .select("id, income_budget_id, expense_budget_id, allocated_amount")
        .eq("user_id", user.id)
        .eq("month_year", monthKey);

      // Calculate allocated amounts per income
      const incomeAllocations = new Map<string, number>();
      allocationsData?.forEach(alloc => {
        const current = incomeAllocations.get(alloc.income_budget_id) || 0;
        incomeAllocations.set(alloc.income_budget_id, current + Number(alloc.allocated_amount));
      });

      const incomes: IncomeBudget[] = incomeData?.map(inc => ({
        id: inc.id,
        category: inc.category,
        plannedAmount: Number(inc.planned_amount),
        allocated: incomeAllocations.get(inc.id) || 0,
      })) || [];

      const expenses: ExpenseAllocation[] = expenseData?.map(exp => {
        const expenseAllocs = allocationsData?.filter(a => a.expense_budget_id === exp.id) || [];
        return {
          expense: {
            id: exp.id,
            category: exp.category,
            plannedAmount: Number(exp.planned_amount),
          },
          allocations: expenseAllocs.map(alloc => {
            const income = incomes.find(i => i.id === alloc.income_budget_id);
            return {
              id: alloc.id,
              incomeId: alloc.income_budget_id,
              incomeCategory: income?.category || "",
              amount: Number(alloc.allocated_amount),
            };
          }),
        };
      }) || [];

      setIncomeBudgets(incomes);
      setExpenseAllocations(expenses);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load budget data");
    } finally {
      setLoading(false);
    }
  };

  const addAllocation = (expenseId: string) => {
    setExpenseAllocations(prev =>
      prev.map(ea =>
        ea.expense.id === expenseId
          ? {
            ...ea,
            allocations: [
              ...ea.allocations,
              { incomeId: "", incomeCategory: "", amount: 0 },
            ],
          }
          : ea
      )
    );
  };

  const updateAllocation = (
    expenseId: string,
    index: number,
    field: "incomeId" | "amount",
    value: string | number
  ) => {
    setExpenseAllocations(prev =>
      prev.map(ea => {
        if (ea.expense.id !== expenseId) return ea;

        const newAllocations = [...ea.allocations];
        if (field === "incomeId") {
          const income = incomeBudgets.find(i => i.id === value);
          newAllocations[index] = {
            ...newAllocations[index],
            incomeId: value as string,
            incomeCategory: income?.category || "",
          };
        } else {
          newAllocations[index] = {
            ...newAllocations[index],
            amount: Number(value),
          };
        }

        return { ...ea, allocations: newAllocations };
      })
    );
  };

  const removeAllocation = (expenseId: string, index: number) => {
    setExpenseAllocations(prev =>
      prev.map(ea =>
        ea.expense.id === expenseId
          ? {
            ...ea,
            allocations: ea.allocations.filter((_, i) => i !== index),
          }
          : ea
      )
    );
  };

  const saveAllocations = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(selectedMonth);
      const monthKey = monthStart.toISOString().split('T')[0];

      // Delete existing allocations for this month
      await supabase
        .from("budget_allocations")
        .delete()
        .eq("user_id", user.id)
        .eq("month_year", monthKey);

      // Insert new allocations
      const allocationsToInsert = expenseAllocations.flatMap(ea =>
        ea.allocations
          .filter(a => a.incomeId && a.amount > 0)
          .map(a => ({
            user_id: user.id,
            month_year: monthKey,
            income_budget_id: a.incomeId,
            expense_budget_id: ea.expense.id,
            allocated_amount: a.amount,
          }))
      );

      if (allocationsToInsert.length > 0) {
        const { error } = await supabase
          .from("budget_allocations")
          .insert(allocationsToInsert);

        if (error) throw error;
      }

      toast.success("Budget allocations saved successfully");
      fetchData();
      onUpdate?.();
    } catch (error) {
      console.error("Error saving allocations:", error);
      toast.error("Failed to save allocations");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (incomeBudgets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Add planned income first to allocate budget
      </div>
    );
  }

  if (expenseAllocations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Add expense budgets first to allocate income
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Income Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {incomeBudgets.map(income => {
          const remaining = income.plannedAmount - income.allocated;
          return (
            <div key={income.id} className="p-3 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{income.category}</p>
              <p className="text-xs text-muted-foreground">
                Planned: ₹{income.plannedAmount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Allocated: ₹{income.allocated.toLocaleString()}
              </p>
              <p className={`text-xs font-medium ${remaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                Remaining: ₹{remaining.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expense Allocations */}
      <div className="space-y-4">
        {expenseAllocations.map(ea => {
          const totalAllocated = ea.allocations.reduce((sum, a) => sum + a.amount, 0);
          const remaining = ea.expense.plannedAmount - totalAllocated;

          return (
            <div key={ea.expense.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{ea.expense.category}</p>
                  <p className="text-xs text-muted-foreground">
                    Planned: ₹{ea.expense.plannedAmount.toLocaleString()} |
                    Allocated: ₹{totalAllocated.toLocaleString()} |
                    <span className={remaining < 0 ? 'text-destructive' : ''}>
                      Remaining: ₹{remaining.toLocaleString()}
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addAllocation(ea.expense.id)}
                >
                  Add Income Source
                </Button>
              </div>

              <div className="space-y-2">
                {ea.allocations.map((alloc, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={alloc.incomeId}
                      onChange={(e) => updateAllocation(ea.expense.id, index, "incomeId", e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Select income source</option>
                      {incomeBudgets.map(income => (
                        <option key={income.id} value={income.id}>
                          {income.category}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={alloc.amount || ""}
                      onChange={(e) => updateAllocation(ea.expense.id, index, "amount", e.target.value)}
                      className="w-32"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeAllocation(ea.expense.id, index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {ea.allocations.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No income sources allocated yet
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={saveAllocations} disabled={saving}>
          {saving ? "Saving..." : "Save Allocations"}
        </Button>
      </div>
    </div>
  );
};

export default BudgetIncomeAllocation;
