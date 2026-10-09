-- Fix RLS policies for investment_instruments AND investment_sub_allocations tables.
-- Drops existing policies and recreates them with correct logic.
-- This resolves: "new row violates row-level security policy for table ..."

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

-- ============================================================
-- investment_sub_allocations RLS fix
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "Household members can view investment sub-allocations" ON public.investment_sub_allocations;
DROP POLICY IF EXISTS "Household members can insert investment sub-allocations" ON public.investment_sub_allocations;
DROP POLICY IF EXISTS "Household members can update investment sub-allocations" ON public.investment_sub_allocations;
DROP POLICY IF EXISTS "Household members can delete investment sub-allocations" ON public.investment_sub_allocations;

DROP POLICY IF EXISTS "investment_sub_allocations_select" ON public.investment_sub_allocations;
DROP POLICY IF EXISTS "investment_sub_allocations_insert" ON public.investment_sub_allocations;
DROP POLICY IF EXISTS "investment_sub_allocations_update" ON public.investment_sub_allocations;
DROP POLICY IF EXISTS "investment_sub_allocations_delete" ON public.investment_sub_allocations;

-- Make sure RLS is enabled (idempotent)
ALTER TABLE public.investment_sub_allocations ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "investment_sub_allocations_select"
  ON public.investment_sub_allocations FOR SELECT
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

-- INSERT policy
CREATE POLICY "investment_sub_allocations_insert"
  ON public.investment_sub_allocations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      household_id IS NULL
      OR public.is_household_member(auth.uid(), household_id)
    )
  );

-- UPDATE policy
CREATE POLICY "investment_sub_allocations_update"
  ON public.investment_sub_allocations FOR UPDATE
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

-- DELETE policy
CREATE POLICY "investment_sub_allocations_delete"
  ON public.investment_sub_allocations FOR DELETE
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

