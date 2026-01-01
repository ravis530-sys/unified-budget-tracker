import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { ArrowLeft, Plus, Target, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import BudgetMonthSelector from "@/components/BudgetMonthSelector";
import { useHousehold } from "@/hooks/useHousehold";

interface MonthlyBudget {
    id: string;
    category: string;
    planned_amount: number;
    type: "income" | "expense";
    interval: string;
    household_id?: string | null;
}

interface BudgetAllocation {
    id: string;
    income_budget_id: string;
    expense_budget_id: string;
    allocated_amount: number;
    income_budget?: MonthlyBudget;
    expense_budget?: MonthlyBudget;
}

const GoalAllocation = () => {
    const navigate = useNavigate();
    const { household } = useHousehold();
    const [scope, setScope] = useState<"individual" | "family">("individual");
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [incomeBudgets, setIncomeBudgets] = useState<MonthlyBudget[]>([]);
    const [expenseBudgets, setExpenseBudgets] = useState<MonthlyBudget[]>([]);
    const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
    const [availableAmounts, setAvailableAmounts] = useState<Record<string, number>>({});

    const [selectedIncomeId, setSelectedIncomeId] = useState("");
    const [selectedExpenseId, setSelectedExpenseId] = useState("");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Reset selection when scope changes
        setSelectedIncomeId("");
        setSelectedExpenseId("");
        setAmount("");
        fetchData();
    }, [selectedMonth, scope, household]);

    const fetchData = async () => {
        try {
            const monthStr = format(selectedMonth, "yyyy-MM-01");
            const end = endOfMonth(selectedMonth);
            const endDateStr = format(end, "yyyy-MM-dd");
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            // Prepare base query modifiers
            const applyScopeFilter = (query: any) => {
                if (scope === "family" && household) {
                    return query.eq("household_id", household.id);
                } else {
                    return query.is("household_id", null).eq("user_id", user.id);
                }
            };

            const start = startOfMonth(selectedMonth);
            const startDateStr = format(start, "yyyy-MM-dd");

            // Fetch current month's budgets for selection (EXPENSE ONLY)
            // Use start_date range to capture goals created on specific days (e.g. Jan 5)
            let expenseQuery = supabase
                .from("monthly_budgets")
                .select("*")
                .gte("start_date", startDateStr)
                .lte("start_date", endDateStr);

            expenseQuery = applyScopeFilter(expenseQuery);

            const { data: currentBudgets, error: budgetError } = await expenseQuery;

            if (budgetError) throw budgetError;

            // Fetch Allocations for CURRENT MONTH (to show in list)
            // Allocations don't have household_id directly, they link to budgets.
            // But we filter by user_id currently. For Family, we might want to see ALL family allocations?
            // Actually, allocations table doesn't have household_id. It's implicit via the budgets.
            // We should filter allocations where the RELATED budget belongs to the scope.
            // This is complex with just a simple query. 
            // Workaround: We fetch allocations and filter in memory based on the budget's scope,
            // OR we trust that if we select valid budgets, the allocations follow.
            // BUT for the "Allocations" list, we need to show only relevant ones.
            // We can filter by checking if the returned income/expense budget belongs to the current scope.

            const { data: currentAllocs, error: currentAllocError } = await supabase
                .from("budget_allocations")
                .select(`
          *,
          income_budget:monthly_budgets!fk_income_budget(category, interval, household_id),
          expense_budget:monthly_budgets!fk_expense_budget(category, interval, household_id)
        `)
                .eq("month_year", monthStr);
            // We can't easily filter by foreign key field at root level in standard Supabase client without inner join syntax nuances.
            // We will filter client side for now.

            if (currentAllocError) throw currentAllocError;

            // Filter allocations client-side based on scope
            const filteredAllocations = (currentAllocs as any[]).filter(alloc => {
                const isFamilyScope = scope === "family" && household;
                if (isFamilyScope) {
                    return alloc.income_budget?.household_id === household.id;
                } else {
                    return !alloc.income_budget?.household_id; // Individual
                }
            });

            setAllocations(filteredAllocations as unknown as BudgetAllocation[]);

            // --- Aggregation Logic ---

            // 1. Fetch ALL historic INCOME transactions
            // Scope applies here too
            let txnQuery = supabase
                .from("transactions")
                .select("amount, category")
                .eq("type", "income")
                .lte("transaction_date", endDateStr);

            txnQuery = applyScopeFilter(txnQuery);

            const { data: allTransactions, error: txnError } = await txnQuery;

            if (txnError) throw txnError;

            // 2. Fetch ALL historic Allocations
            // We need to fetch ALL to subtract, but only relevant to this scope
            const { data: allAllocations, error: allAllocError } = await supabase
                .from("budget_allocations")
                .select(`
                    allocated_amount,
                    month_year,
                    income_budget:monthly_budgets!fk_income_budget(category, household_id)
                `);
            // Again, filtering client side for correct calculations

            if (allAllocError) throw allAllocError;

            // 3. Fetch ALL historic Income Budgets (needed for ID lookup only)
            let incomeBudgetsQuery = supabase
                .from("monthly_budgets")
                .select("*")
                .eq("type", "income")
                .order("month_year", { ascending: false });

            incomeBudgetsQuery = applyScopeFilter(incomeBudgetsQuery);

            const { data: allIncomeBudgets, error: allIncomeError } = await incomeBudgetsQuery;

            if (allIncomeError) throw allIncomeError;

            // 4. Calculate Stats per Category & Build Budget List from TRANSACTIONS
            const incomeMap: Record<string, number> = {};
            const categoryToBudgetId: Record<string, string> = {}; // Map category -> latest budget_id
            const categoryToBudgetObj: Record<string, MonthlyBudget> = {}; // Map category -> budget object

            // Map categories to valid budget IDs (latest one found)
            allIncomeBudgets?.forEach(b => {
                if (!categoryToBudgetId[b.category]) {
                    categoryToBudgetId[b.category] = b.id;
                    categoryToBudgetObj[b.category] = b as unknown as MonthlyBudget;
                }
            });

            // Sum up actual income
            const presentCategories = new Set<string>();
            allTransactions?.forEach(txn => {
                incomeMap[txn.category] = (incomeMap[txn.category] || 0) + txn.amount;
                presentCategories.add(txn.category);
            });

            // Sum up allocated amounts (Filter by scope first)
            const allocatedMap: Record<string, number> = {};
            allAllocations?.forEach((alloc: any) => {
                // Check date (Cumulative up to selected month)
                // monthStr is "yyyy-MM-01", effectively the start of the month.
                // If allocation is for a FUTURE month, ignore it.
                if (alloc.month_year > monthStr) return;

                // Check if this allocation belongs to current scope
                const isFamilyScope = scope === "family" && household;
                const matchesScope = isFamilyScope
                    ? alloc.income_budget?.household_id === household.id
                    : !alloc.income_budget?.household_id;

                if (matchesScope) {
                    const category = alloc.income_budget?.category;
                    if (category) {
                        allocatedMap[category] = (allocatedMap[category] || 0) + alloc.allocated_amount;
                    }
                }
            });

            // 5. Construct the list of "Income Sources" for the dropdown
            const derivedIncomeBudgets: MonthlyBudget[] = [];
            const available: Record<string, number> = {};

            presentCategories.forEach(category => {
                let budgetId = categoryToBudgetId[category];
                let budgetObj = categoryToBudgetObj[category];

                // If no budget exists for this earning category, create a virtual one for the UI
                if (!budgetId) {
                    budgetId = `virtual-${category}`;
                    budgetObj = {
                        id: budgetId,
                        category: category,
                        planned_amount: 0,
                        type: "income",
                        interval: "Irregular", // Default for unbudgeted income
                        household_id: scope === "family" && household ? household.id : null
                    } as MonthlyBudget;
                }

                derivedIncomeBudgets.push(budgetObj);

                const totalIncome = incomeMap[category] || 0;
                const totalAllocated = allocatedMap[category] || 0;
                available[budgetId] = totalIncome - totalAllocated;
            });

            setIncomeBudgets(derivedIncomeBudgets);
            setAvailableAmounts(available);

            const expense = (currentBudgets?.filter(b => b.type === "expense") || []) as MonthlyBudget[];
            setExpenseBudgets(expense);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load allocation data");
        }
    };

    const handleAllocate = async () => {
        if (!selectedIncomeId || !selectedExpenseId || !amount) {
            toast.error("Please fill in all fields");
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        const available = availableAmounts[selectedIncomeId] || 0;
        if (amountNum > available) {
            toast.error(`Amount exceeds available balance (${available})`);
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const monthStr = format(selectedMonth, "yyyy-MM-01");
            let finalIncomeId = selectedIncomeId;

            // Handle "Virtual" budgets (Unbudgeted Income)
            // If the user selected a source that has no DB entry yet, create it now.
            if (selectedIncomeId.startsWith("virtual-")) {
                const categoryName = selectedIncomeId.replace("virtual-", "");

                // Create a basic budget entry so we have an ID
                const { data: newBudget, error: createError } = await supabase
                    .from("monthly_budgets")
                    .insert({
                        user_id: user?.id,
                        category: categoryName,
                        month_year: monthStr,
                        start_date: monthStr, // Sync start_date for consistency
                        type: "income",
                        planned_amount: 0, // It was unplanned
                        interval: "Irregular",
                        household_id: scope === "family" && household ? household.id : null
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                finalIncomeId = newBudget.id;
            }

            const { error } = await supabase
                .from("budget_allocations")
                .insert({
                    income_budget_id: finalIncomeId,
                    expense_budget_id: selectedExpenseId,
                    allocated_amount: amountNum,
                    month_year: monthStr,
                    user_id: user?.id
                });

            if (error) throw error;

            toast.success("Allocation created successfully");
            setAmount("");
            setSelectedExpenseId("");
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create allocation");
        } finally {
            setLoading(false);
        }
    };

    const handleScopeChange = (val: string) => {
        setScope(val as "individual" | "family");
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">Goal Allocation</h1>
                            <p className="text-sm text-muted-foreground">Allocate earnings to your goals</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

                <div className="flex flex-col items-center gap-4">
                    <Tabs value={scope} onValueChange={handleScopeChange} className="w-full max-w-[400px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="individual">Individual</TabsTrigger>
                            <TabsTrigger value="family" disabled={!household}>Family {(!household ? "(No Household)" : "")}</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <BudgetMonthSelector
                        selectedMonth={selectedMonth}
                        onMonthChange={setSelectedMonth}
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Allocation ({scope === 'individual' ? 'Personal' : 'Family'})</CardTitle>
                            <CardDescription>Link an income source to an expense goal</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Source (Earning)</Label>
                                <Select value={selectedIncomeId} onValueChange={setSelectedIncomeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select income source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {incomeBudgets.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">No income found for this scope</div>
                                        ) : (
                                            incomeBudgets.map(b => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {b.category} ({b.interval}) - Available: {availableAmounts[b.id] || 0}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Target (Goal/Expense)</Label>
                                <Select value={selectedExpenseId} onValueChange={setSelectedExpenseId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select goal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {expenseBudgets.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">No goals found for this month</div>
                                        ) : (
                                            expenseBudgets.map(b => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {b.category} ({b.interval}) - Target: {b.planned_amount}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Amount to Allocate</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                                    <Input
                                        type="number"
                                        className="pl-8"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button className="w-full" onClick={handleAllocate} disabled={loading}>
                                {loading ? "Allocating..." : "Allocate Funds"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Allocations</CardTitle>
                            <CardDescription>
                                Current month's allocations ({allocations.length})
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {allocations.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-4">No allocations yet</p>
                                ) : (
                                    allocations.map(alloc => (
                                        <div key={alloc.id} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <Banknote className="h-4 w-4 text-green-500" />
                                                    <span>{alloc.income_budget?.category}</span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <Target className="h-4 w-4 text-blue-500" />
                                                    <span>{alloc.expense_budget?.category}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {alloc.income_budget?.interval} to {alloc.expense_budget?.interval}
                                                </p>
                                            </div>
                                            <p className="font-bold">₹{alloc.allocated_amount}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default GoalAllocation;
