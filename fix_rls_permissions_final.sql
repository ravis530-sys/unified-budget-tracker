-- ============================================
-- FINAL RLS PERMISSIONS FIX
-- Run this script in Supabase SQL Editor to fix:
-- "permission denied for view rls_members_view"
-- ============================================

-- 1. Reset everything to a clean state
DROP VIEW IF EXISTS public.rls_members_view CASCADE;

-- 2. Create the Security Wrapper View
-- This view bypasses RLS recursion by providing a direct window to the data
CREATE VIEW public.rls_members_view AS 
SELECT * FROM public.household_members;

-- Ensure the view belongs to postgres
ALTER VIEW public.rls_members_view OWNER TO postgres;

-- 3. Secure the View
-- Revoke all public/authenticated access to ensure it's only used by secure functions
REVOKE ALL ON public.rls_members_view FROM public, authenticated, anon;
GRANT SELECT ON public.rls_members_view TO postgres, service_role;

-- 4. Create SECURE HELPER FUNCTIONS (Security Definer)
-- These run with the system owner's privileges (postgres)

-- Helper: Get IDs of households user belongs to
CREATE OR REPLACE FUNCTION public.get_user_household_ids()
RETURNS TABLE (household_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT m.household_id FROM public.rls_members_view m WHERE m.user_id = auth.uid();
END; $$;

-- Helper: Get IDs of households where user is ADMIN
CREATE OR REPLACE FUNCTION public.get_admin_household_ids()
RETURNS TABLE (household_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT m.household_id FROM public.rls_members_view m WHERE m.user_id = auth.uid() AND m.role = 'admin';
END; $$;

-- Helper: Get IDs of all users sharing households with current user
CREATE OR REPLACE FUNCTION public.get_all_household_members_user_ids()
RETURNS TABLE (user_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT m.user_id 
  FROM public.rls_members_view m 
  WHERE m.household_id IN (SELECT f.household_id FROM public.get_user_household_ids() f);
END; $$;

-- Grant execution permissions back to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_household_ids TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_household_ids TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_household_members_user_ids TO authenticated, service_role;

-- 5. Apply Policies to Tables
-- This ensures all logic uses the secure functions

-- HOUSEHOLD_MEMBERS
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view household members" ON public.household_members;
CREATE POLICY "Members can view household members" ON public.household_members
  FOR SELECT USING (household_id IN (SELECT * FROM public.get_user_household_ids()));

DROP POLICY IF EXISTS "Admins can manage members" ON public.household_members;
CREATE POLICY "Admins can manage members" ON public.household_members
  FOR ALL USING (household_id IN (SELECT * FROM public.get_admin_household_ids()));

-- HOUSEHOLDS
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View households" ON public.households;
CREATE POLICY "View households" ON public.households
  FOR SELECT USING (id IN (SELECT * FROM public.get_user_household_ids()));

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "View household member profiles" ON public.profiles;
CREATE POLICY "View household member profiles" ON public.profiles
  FOR SELECT USING (id IN (SELECT * FROM public.get_all_household_members_user_ids()));

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View transactions" ON public.transactions;
CREATE POLICY "View transactions" ON public.transactions
  FOR SELECT USING (user_id = auth.uid() OR household_id IN (SELECT * FROM public.get_user_household_ids()));

DROP POLICY IF EXISTS "Manage transactions" ON public.transactions;
CREATE POLICY "Manage transactions" ON public.transactions
  FOR ALL USING (user_id = auth.uid() OR household_id IN (SELECT * FROM public.get_user_household_ids()));
