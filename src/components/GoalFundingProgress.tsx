import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Target, CheckCircle2, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExpenseGoal {
    id: string;
    category: string;
    planned_amount: number;
    start_date: string;
    end_date?: string | null;
    interval: string;
    totalFunded: number;
}

interface GoalFundingProgressProps {
    scope: "individual" | "family";
    selectedMonth: Date;
    onDataLoaded?: (hasData: boolean) => void;
}

const GoalFundingProgress = ({ scope, selectedMonth, onDataLoaded }: GoalFundingProgressProps) => {
    const [goals, setGoals] = useState<ExpenseGoal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGoals();
    }, [scope, selectedMonth]);

    const fetchGoals = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
            const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

            // Get household for family scope
            let householdId: string | null = null;
            if (scope === "family") {
                const { data: membership } = await supabase
                    .from("household_members")
                    .select("household_id")
                    .eq("user_id", user.id)
                    .single();
                householdId = membership?.household_id || null;
            }

            // Fetch expense goals active in the selected month
            let budgetQuery = supabase
                .from("monthly_budgets")
                .select("id, category, planned_amount, start_date, end_date, interval")
                .eq("type", "expense")
                .lte("start_date", monthEnd);   // goal starts on or before month end

            if (scope === "individual") {
                budgetQuery = budgetQuery.eq("user_id", user.id).is("household_id", null);
            } else {
                budgetQuery = budgetQuery.eq("household_id", householdId);
            }

            const { data: rawGoals } = await budgetQuery;

            // Client-side filter: goal must overlap with selected month
            const activeGoals = (rawGoals || []).filter(g => {
                if (!g.end_date) return true;         // open-ended goal: always active
                return g.end_date >= monthStart;      // end_date on or after month start
            });

            if (activeGoals.length === 0) {
                setGoals([]);
                onDataLoaded?.(false);
                return;
            }

            // Fetch cumulative funded amounts for these goals across all months
            const goalIds = activeGoals.map(g => g.id);
            const { data: allocs } = await supabase
                .from("budget_allocations")
                .select("expense_budget_id, allocated_amount")
                .in("expense_budget_id", goalIds);

            const fundedMap: Record<string, number> = {};
            (allocs || []).forEach((row: any) => {
                const id = row.expense_budget_id;
                fundedMap[id] = (fundedMap[id] || 0) + Number(row.allocated_amount);
            });

            const result: ExpenseGoal[] = activeGoals.map(g => ({
                ...g,
                planned_amount: Number(g.planned_amount),
                totalFunded: fundedMap[g.id] || 0,
            }));

            // Sort: in-progress first, fully funded last
            result.sort((a, b) => {
                const aFull = a.planned_amount > 0 && a.totalFunded >= a.planned_amount;
                const bFull = b.planned_amount > 0 && b.totalFunded >= b.planned_amount;
                if (aFull && !bFull) return 1;
                if (!aFull && bFull) return -1;
                return 0;
            });

            setGoals(result);
            onDataLoaded?.(result.length > 0);
        } catch (err) {
            console.error("GoalFundingProgress fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2].map(i => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                ))}
            </div>
        );
    }

    if (goals.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Target className="h-8 w-8 opacity-30" />
                <p className="text-sm">No expense goals planned for this month</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {goals.map(goal => {
                const isFullyFunded = goal.planned_amount > 0 && goal.totalFunded >= goal.planned_amount;
                const pct = goal.planned_amount > 0
                    ? Math.min((goal.totalFunded / goal.planned_amount) * 100, 100)
                    : 0;
                const remaining = Math.max(0, goal.planned_amount - goal.totalFunded);
                const isMultiMonth = goal.end_date && goal.end_date !== goal.start_date;

                const barColor = isFullyFunded
                    ? "bg-green-500"
                    : pct >= 80
                    ? "bg-amber-500"
                    : "bg-primary";

                return (
                    <div
                        key={goal.id}
                        className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            isFullyFunded
                                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                : "bg-card"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                {isFullyFunded ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                ) : (
                                    <Target className="h-4 w-4 text-primary shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="font-medium text-sm leading-tight truncate">{goal.category}</p>
                                    {isMultiMonth && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <CalendarRange className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">
                                                {goal.start_date} → {goal.end_date}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                {isFullyFunded ? (
                                    <Badge
                                        variant="outline"
                                        className="text-green-600 border-green-400 text-xs font-semibold"
                                    >
                                        ✅ Fully Funded
                                    </Badge>
                                ) : (
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        {pct.toFixed(0)}%
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                    <span className="font-medium text-foreground">
                                        ₹{goal.totalFunded.toLocaleString()}
                                    </span>
                                    {" "}funded of ₹{goal.planned_amount.toLocaleString()}
                                </span>
                                {!isFullyFunded && goal.planned_amount > 0 && (
                                    <span className="text-amber-600 font-medium">
                                        ₹{remaining.toLocaleString()} to go
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GoalFundingProgress;
