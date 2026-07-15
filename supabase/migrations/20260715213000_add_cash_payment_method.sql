-- Drop the old payment_method check constraint if it exists
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

-- Add the updated check constraint including 'cash'
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check CHECK (payment_method IN ('creditcard', 'upi', 'cash'));
