-- Create budget_allocations table to map income sources to expense categories
CREATE TABLE public.budget_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month_year DATE NOT NULL,
  income_budget_id UUID NOT NULL,
  expense_budget_id UUID NOT NULL,
  allocated_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_income_budget FOREIGN KEY (income_budget_id) REFERENCES public.monthly_budgets(id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_budget FOREIGN KEY (expense_budget_id) REFERENCES public.monthly_budgets(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for budget_allocations
CREATE POLICY "Users can view own allocations"
ON public.budget_allocations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own allocations"
ON public.budget_allocations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own allocations"
ON public.budget_allocations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own allocations"
ON public.budget_allocations
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_budget_allocations_updated_at
BEFORE UPDATE ON public.budget_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_budget_allocations_user_month ON public.budget_allocations(user_id, month_year);
CREATE INDEX idx_budget_allocations_income ON public.budget_allocations(income_budget_id);
CREATE INDEX idx_budget_allocations_expense ON public.budget_allocations(expense_budget_id);