-- Fix existing auto-created allocation stubs that were incorrectly stored with interval='pending'.
-- These are monthly_budget rows of type='expense' and planned_amount=0 that exist ONLY as
-- the target side of a budget_allocation (i.e. their id appears in budget_allocations.expense_budget_id)
-- but were never created by the user through the Expense Goals / Budget Planning UI.
--
-- We identify them by: type='expense', planned_amount=0, interval='pending',
-- AND their id is referenced in budget_allocations.expense_budget_id.
-- Real user-planned goals always have planned_amount > 0, so this is a safe discriminator.

UPDATE public.monthly_budgets
SET interval = 'allocation_only'
WHERE
    type = 'expense'
    AND planned_amount = 0
    AND interval = 'pending'
    AND id IN (
        SELECT DISTINCT expense_budget_id FROM public.budget_allocations
    );
