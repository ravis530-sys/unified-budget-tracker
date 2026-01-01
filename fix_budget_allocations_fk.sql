-- Rename/Ensure Foreign Key constraints exist with the expected names
-- This is necessary for Supabase API to disambiguate the two relationships to monthly_budgets

DO $$
BEGIN
    -- 1. Try to drop existing constraints if they exist with generic names or old names
    -- We can't know the exact random name, but we can try to drop if we named them before.
    -- Better approach: Alter the table to drop specific constraints if we knew them.
    -- Since we want to ENFORCE the names, let's try to add them. If they exist on the columns, we might duplicate.
    
    -- Let's try to drop the ones we want to create first to be idempotent
    BEGIN
        ALTER TABLE budget_allocations DROP CONSTRAINT IF EXISTS fk_income_budget;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        ALTER TABLE budget_allocations DROP CONSTRAINT IF EXISTS fk_expense_budget;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Add them back with explicit names
    -- Note: We assume the columns income_budget_id and expense_budget_id exist.
    
    ALTER TABLE budget_allocations
    ADD CONSTRAINT fk_income_budget
    FOREIGN KEY (income_budget_id)
    REFERENCES monthly_budgets(id)
    ON DELETE CASCADE;

    ALTER TABLE budget_allocations
    ADD CONSTRAINT fk_expense_budget
    FOREIGN KEY (expense_budget_id)
    REFERENCES monthly_budgets(id)
    ON DELETE CASCADE;

END $$;

-- Reload the schema cache is usually automatic, but good to know this runs.
NOTIFY pgrst, 'reload config';
