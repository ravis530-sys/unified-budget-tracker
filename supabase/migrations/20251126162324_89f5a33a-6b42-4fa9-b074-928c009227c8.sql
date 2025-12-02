-- Add interval and start_date columns to monthly_budgets table
ALTER TABLE public.monthly_budgets
ADD COLUMN interval text NOT NULL DEFAULT 'monthly',
ADD COLUMN start_date date NOT NULL DEFAULT CURRENT_DATE;

-- Add check constraint for valid intervals
ALTER TABLE public.monthly_budgets
ADD CONSTRAINT valid_interval CHECK (interval IN ('one-time', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'));