-- Add 'investment' as a valid transaction type
-- This migration updates the check constraint on the transactions table to allow 'investment' type

-- Drop the existing check constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add the new check constraint with 'investment' included
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('income', 'expense', 'investment'));
