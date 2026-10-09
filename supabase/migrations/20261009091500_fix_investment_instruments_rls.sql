-- Fix RLS policies for investment_instruments table
-- Drops existing policies and recreates them with correct logic.
-- This resolves: "new row violates row-level security policy for table investment_instruments"

-- 1. Drop old policies (safe: IF EXISTS)
DROP POLICY IF EXISTS "Household members can view investment instruments" ON public.investment_instruments;
DROP POLICY IF EXISTS "Household members can insert investment instruments" ON public.investment_instruments;
DROP POLICY IF EXISTS "Household members can update investment instruments" ON public.investment_instruments;
DROP POLICY IF EXISTS "Household members can delete investment instruments" ON public.investment_instruments;

DROP POLICY IF EXISTS "investment_instruments_select" ON public.investment_instruments;
DROP POLICY IF EXISTS "investment_instruments_insert" ON public.investment_instruments;
DROP POLICY IF EXISTS "investment_instruments_update" ON public.investment_instruments;
DROP POLICY IF EXISTS "investment_instruments_delete" ON public.investment_instruments;

-- 2. Make sure RLS is enabled (idempotent)
ALTER TABLE public.investment_instruments ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policy
CREATE POLICY "investment_instruments_select"
  ON public.investment_instruments FOR SELECT
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

-- 4. INSERT policy  
CREATE POLICY "investment_instruments_insert"
  ON public.investment_instruments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      household_id IS NULL
      OR public.is_household_member(auth.uid(), household_id)
    )
  );

-- 5. UPDATE policy
CREATE POLICY "investment_instruments_update"
  ON public.investment_instruments FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      household_id IS NULL
      OR public.is_household_member(auth.uid(), household_id)
    )
  );

-- 6. DELETE policy
CREATE POLICY "investment_instruments_delete"
  ON public.investment_instruments FOR DELETE
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );
