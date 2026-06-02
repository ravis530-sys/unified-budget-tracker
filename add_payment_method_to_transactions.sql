-- Add payment_method column to transactions table
ALTER TABLE public.transactions
ADD COLUMN payment_method text CHECK (payment_method IN ('creditcard', 'upi'));
