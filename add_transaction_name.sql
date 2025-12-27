-- Add optional name column to transactions table

ALTER TABLE transactions
ADD COLUMN name TEXT;
