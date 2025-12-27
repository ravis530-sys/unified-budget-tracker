import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import EditBudgetDialog from "./EditBudgetDialog";
import { calculateCarryForward } from "@/lib/budgetUtils";
import { Badge } from "@/components/ui/badge";

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
  selectedMonth?: Date;
  viewMode?: "monthly" | "goals";
  onUpdate: () => void;
  scope: "individual" | "family";
}

const BudgetCategoryList = ({ type, selectedMonth, viewMode = "monthly", onUpdate, scope }: BudgetCategoryListProps) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  useEffect(() => {
    fetchBudgets();
  }, [type, selectedMonth, scope, viewMode]);

  const fetchBudgets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        .eq("type", type);

      if (viewMode === "monthly" && selectedMonth) {
        const monthEndStr = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
        query = query.lte("start_date", monthEndStr);
      }

      // For 'goals' view, we don't filter by date, but logic might refine this later if needed.
      // We will sort Pending first.

      if (scope === "individual") {
        query = query.eq("user_id", user.id).is("household_id", null);
      } else { // scope === "family"
        query = query.eq("household_id", householdId);
      }

      const { data, error } = await query.order("category");

      if (error) throw error;

      let processedData = data || [];

      if (viewMode === "monthly" && selectedMonth) {
        const monthStartStr = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
        // Filter in client for the OR condition (end_date >= start OR end_date is null)
        processedData = processedData.filter(budget => {
          // If it's explicitly 'done', maybe hide it from monthly view? 
          // Or user wants to see done items if they overlap. 
          // Legacy logic:
          if (!budget.end_date) return true;
          return budget.end_date >= monthStartStr;
        });

        // Calculate carry forward only for monthly view
        const budgetsWithCarryForward = await Promise.all(
          processedData.map(async (budget) => {
            let carryForward = 0;
            if (type === "income") {
              carryForward = await calculateCarryForward(user.id, budget.category, selectedMonth);
            }
            return { ...budget, carry_forward: carryForward };
          })
        );
        processedData = budgetsWithCarryForward;
      }

      // Sort: Pending (not done) first
      processedData.sort((a, b) => {
        const aDone = a.interval === 'done';
        const bDone = b.interval === 'done';
        if (aDone === bDone) return 0;
        return aDone ? 1 : -1;
      });

      setBudgets(processedData);
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

  const toggleStatus = async (budget: Budget) => {
    const newStatus = budget.interval === 'done' ? 'pending' : 'done';
    try {
      const { error } = await supabase
        .from("monthly_budgets")
        .update({ interval: newStatus })
        .eq("id", budget.id);

      if (error) throw error;
      toast.success(`Goal marked as ${newStatus}`);
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (budgets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No {type} items found
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {budgets.map((budget) => {
          const isDone = budget.interval === 'done';
          return (
            <div
              key={budget.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${isDone ? 'bg-muted/30 opacity-70' : 'bg-muted/50'}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>{budget.category}</p>
                  {viewMode === 'goals' && (
                    <Badge variant={isDone ? "secondary" : "default"} className="text-[10px] py-0 h-5">
                      {isDone ? 'Done' : 'Pending'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  ₹{Number(budget.planned_amount).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {format(new Date(budget.start_date), "MMM d, yyyy")}
                  {budget.end_date ? ` - ${format(new Date(budget.end_date), "MMM d, yyyy")}` : ""}
                </p>
                {viewMode === 'monthly' && budget.carry_forward && budget.carry_forward > 0 ? (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    + ₹{budget.carry_forward.toLocaleString()} carry forward
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1">
                {viewMode === 'goals' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title={isDone ? "Mark as Pending" : "Mark as Done"}
                    onClick={() => toggleStatus(budget)}
                  >
                    {isDone ? <XCircle className="h-4 w-4 text-orange-500" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  </Button>
                )}
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
          )
        })}
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
