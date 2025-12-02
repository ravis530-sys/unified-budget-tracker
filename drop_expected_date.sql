-- Remove expected_date column
ALTER TABLE monthly_budgets 
DROP COLUMN IF EXISTS expected_date;
