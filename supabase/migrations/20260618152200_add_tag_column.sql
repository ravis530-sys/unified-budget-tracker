-- Add optional tag column to transactions table for "Paid Back" tracking
-- When an expense has tag = 'paid_back', it indicates this expense will be reimbursed.
-- When an income has tag = 'paid_back:<expense_id>', it links to the reimbursed expense.
-- Both paired transactions are excluded from dashboard totals.
ALTER TABLE public.transactions ADD COLUMN tag text DEFAULT NULL;
