import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, format } from "date-fns";
import EditBudgetDialog from "./EditBudgetDialog";
import { calculateCarryForward } from "@/lib/budgetUtils";

interface Budget {
  id: string;
  category: string;
  planned_amount: number;
  type: string;
  interval: string;
  start_date: string;
  end_date?: string;
  carry_forward?: number;
}

interface BudgetCategoryListProps {
  type: "income" | "expense";
  selectedMonth: Date;
  onUpdate: () => void;
  scope: "individual" | "family";
}

const BudgetCategoryList = ({ type, selectedMonth, onUpdate, scope }: BudgetCategoryListProps) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  useEffect(() => {
    fetchBudgets();
  }, [type, selectedMonth, scope]);

  const fetchBudgets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(selectedMonth);

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

      let query = supabase
        .from("monthly_budgets")
        .select("*")
        .eq("type", type)
        .eq("month_year", monthStart.toISOString().split('T')[0]);

      if (scope === "individual") {
        query = query.eq("user_id", user.id).is("household_id", null);
      } else { // scope === "family"
        query = query.eq("household_id", householdId);
      }

      const { data, error } = await query
        .order("category");

      if (error) throw error;

      const budgetsWithCarryForward = await Promise.all(
        (data || []).map(async (budget) => {
          let carryForward = 0;
          if (type === "income") {
            carryForward = await calculateCarryForward(user.id, budget.category, selectedMonth);
          }
          return { ...budget, carry_forward: carryForward };
        })
      );

      setBudgets(budgetsWithCarryForward);
    } catch (error: any) {
      console.error("Error fetching budgets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (budget: Budget) => {
    setSelectedBudget(budget);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setSelectedBudget(null);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("monthly_budgets")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Budget deleted");
      onUpdate();
    } catch (error: any) {
      toast.error("Failed to delete budget");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (budgets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No {type} budgets set for this month
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {budgets.map((budget) => (
          <div
            key={budget.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
          >
            <div>
              <p className="font-medium">{budget.category}</p>
              <p className="text-sm text-muted-foreground">
                ₹{Number(budget.planned_amount).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {budget.interval.replace('-', ' ')} • Expected {format(new Date(budget.start_date), "MMM d, yyyy")}
                {budget.end_date && ` • Ends ${format(new Date(budget.end_date), "MMM d, yyyy")}`}
              </p>
              {budget.carry_forward && budget.carry_forward > 0 ? (
                <p className="text-xs text-green-600 font-medium mt-1">
                  + ₹{budget.carry_forward.toLocaleString()} carry forward
                </p>
              ) : null}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(budget)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(budget.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <EditBudgetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
        budget={selectedBudget}
      />
    </>
  );
};

export default BudgetCategoryList;
