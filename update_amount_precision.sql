-- Update precision for amount columns in all relevant tables
-- Changing from DECIMAL(10, 2) to DECIMAL(15, 4) to support 4 decimal places

ALTER TABLE transactions
ALTER COLUMN amount TYPE DECIMAL(15, 4);

ALTER TABLE monthly_budgets
ALTER COLUMN planned_amount TYPE DECIMAL(15, 4);

ALTER TABLE budget_allocations
ALTER COLUMN allocated_amount TYPE DECIMAL(15, 4);
