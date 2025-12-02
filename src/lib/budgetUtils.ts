import { supabase } from "@/integrations/supabase/client";
import { startOfMonth } from "date-fns";

/**
 * Calculate the total accumulated carry-forward amount for a specific income category
 * This sums up ALL ACTUAL INCOME transactions from all previous months minus ALLOCATED amounts
 * 
 * Carry Forward = (Total Actual Income Received) - (Total Amount Allocated to Expenses)
 * 
 * @param userId - The user ID
 * @param category - The income category to calculate carry-forward for
 * @param currentMonth - The month to calculate carry-forward up to (exclusive)
 * @param householdId - The household ID (null for individual scope)
 * @returns The total accumulated surplus from all previous months
 */
export const calculateCarryForward = async (
    userId: string,
    category: string,
    currentMonth: Date,
    householdId: string | null = null
): Promise<number> => {
    try {
        const currentMonthStart = startOfMonth(currentMonth).toISOString().split('T')[0];

        console.log(`Calculating carry-forward for category: ${category}, current month: ${currentMonthStart}, householdId: ${householdId}`);

        // 1. Get total actual income from transactions for all previous months
        let transactionQuery = supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", userId)
            .eq("category", category)
            .eq("type", "income")
            .lt("transaction_date", currentMonthStart);

        if (householdId) {
            transactionQuery = transactionQuery.eq("household_id", householdId);
        } else {
            transactionQuery = transactionQuery.is("household_id", null);
        }

        const { data: transactions } = await transactionQuery;

        const totalActualIncome = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        console.log(`Total actual income for ${category} (previous months):`, totalActualIncome);

        // 2. Get total allocated amount from budget allocations for all previous months
        // First, get the budget IDs for this category
        let budgetQuery = supabase
            .from("monthly_budgets")
            .select("id")
            .eq("user_id", userId)
            .eq("category", category)
            .eq("type", "income")
            .lt("month_year", currentMonthStart);

        if (householdId) {
            budgetQuery = budgetQuery.eq("household_id", householdId);
        } else {
            budgetQuery = budgetQuery.is("household_id", null);
        }

        const { data: budgets } = await budgetQuery;

        let totalAllocated = 0;

        if (budgets && budgets.length > 0) {
            const budgetIds = budgets.map(b => b.id);

            const { data: allocations } = await supabase
                .from("budget_allocations")
                .select("allocated_amount")
                .in("income_budget_id", budgetIds);

            totalAllocated = allocations?.reduce((sum, a) => sum + Number(a.allocated_amount), 0) || 0;
        }
        console.log(`Total allocated for ${category} (previous months):`, totalAllocated);

        // 3. Carry Forward = Actual Income - Allocated Amount
        // We only carry forward positive amounts (surplus)
        const carryForward = totalActualIncome - totalAllocated;
        const finalCarryForward = carryForward > 0 ? carryForward : 0;

        console.log(`Final Carry Forward for ${category}: ${finalCarryForward}`);

        return finalCarryForward;
    } catch (error) {
        console.error("Error calculating carry forward:", error);
        return 0;
    }
};

/**
 * Calculate the TOTAL accumulated carry-forward amount across ALL income categories
 * This sums up ALL ACTUAL INCOME transactions from all previous months minus ALLOCATED amounts
 * 
 * @param userId - The user ID
 * @param currentMonth - The month to calculate carry-forward up to (exclusive)
 * @param householdId - The household ID (null for individual scope)
 * @returns The total accumulated surplus from all previous months
 */
export const calculateTotalGlobalCarryForward = async (
    userId: string,
    currentMonth: Date,
    householdId: string | null = null
): Promise<number> => {
    try {
        const currentMonthStart = startOfMonth(currentMonth).toISOString().split('T')[0];

        console.log(`Calculating GLOBAL carry-forward, current month: ${currentMonthStart}, householdId: ${householdId}`);

        // 1. Get total actual income from transactions for all previous months
        let transactionQuery = supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", userId)
            .eq("type", "income")
            .lt("transaction_date", currentMonthStart);

        if (householdId) {
            transactionQuery = transactionQuery.eq("household_id", householdId);
        } else {
            transactionQuery = transactionQuery.is("household_id", null);
        }

        const { data: transactions } = await transactionQuery;

        const totalActualIncome = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        console.log(`Total GLOBAL actual income (previous months):`, totalActualIncome);

        // 2. Get total allocated amount from budget allocations for all previous months
        // We need to find allocations linked to income budgets that are from previous months

        // First, get ALL income budget IDs from previous months
        let budgetQuery = supabase
            .from("monthly_budgets")
            .select("id")
            .eq("user_id", userId)
            .eq("type", "income")
            .lt("month_year", currentMonthStart);

        if (householdId) {
            budgetQuery = budgetQuery.eq("household_id", householdId);
        } else {
            budgetQuery = budgetQuery.is("household_id", null);
        }

        const { data: budgets } = await budgetQuery;

        let totalAllocated = 0;

        if (budgets && budgets.length > 0) {
            const budgetIds = budgets.map(b => b.id);

            const { data: allocations } = await supabase
                .from("budget_allocations")
                .select("allocated_amount")
                .in("income_budget_id", budgetIds);

            totalAllocated = allocations?.reduce((sum, a) => sum + Number(a.allocated_amount), 0) || 0;
        }
        console.log(`Total GLOBAL allocated (previous months):`, totalAllocated);

        // 3. Carry Forward = Actual Income - Allocated Amount
        const carryForward = totalActualIncome - totalAllocated;
        const finalCarryForward = carryForward > 0 ? carryForward : 0;

        console.log(`Final GLOBAL Carry Forward: ${finalCarryForward}`);

        return finalCarryForward;
    } catch (error) {
        console.error("Error calculating global carry forward:", error);
        return 0;
    }
};
