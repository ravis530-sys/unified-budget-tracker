-- Drop existing household-based RLS policies and create user-based ones

-- Monthly Budgets policies
DROP POLICY IF EXISTS "Household members can view budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Household members can insert budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Household members can update budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Household members can delete budgets" ON public.monthly_budgets;

CREATE POLICY "Users can view own budgets" ON public.monthly_budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets" ON public.monthly_budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets" ON public.monthly_budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets" ON public.monthly_budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
DROP POLICY IF EXISTS "Household members can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Household members can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Household members can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Household members can delete transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);