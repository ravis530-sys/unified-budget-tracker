-- ============================================
-- UNIFIED RLS FIX (Security Wrapper Version)
-- Fixes: "permission denied for view", 403 Errors, and Infinite Loops
-- ============================================

-- 1. Create a privileged view to break recursion
CREATE OR REPLACE VIEW rls_members_view AS
SELECT * FROM household_members;

-- Secure the view (Keep it private)
REVOKE ALL ON rls_members_view FROM authenticated, anon, public;

-- 2. Create SECURE HELPER FUNCTIONS (Security Definer)
-- These functions run with the privileges of the creator (postgres) 
-- and can therefore access rls_members_view.

-- Helper: Get IDs of households user belongs to
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS TABLE (household_id UUID) 
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT m.household_id FROM rls_members_view m WHERE m.user_id = auth.uid();
END; $$ LANGUAGE plpgsql;

-- Helper: Get IDs of households where user is ADMIN
CREATE OR REPLACE FUNCTION get_user_managed_household_ids()
RETURNS TABLE (household_id UUID) 
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT m.household_id FROM rls_members_view m WHERE m.user_id = auth.uid() AND m.role = 'admin';
END; $$ LANGUAGE plpgsql;

-- Helper: Get IDs of all users sharing households with current user
CREATE OR REPLACE FUNCTION get_all_household_members_user_ids()
RETURNS TABLE (user_id UUID) 
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT m.user_id 
  FROM rls_members_view m 
  WHERE m.household_id IN (SELECT f.household_id FROM get_user_household_ids() f);
END; $$ LANGUAGE plpgsql;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION get_user_household_ids TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_managed_household_ids TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_household_members_user_ids TO authenticated, service_role;

-- 3. Apply policies to households
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View households" ON households;
CREATE POLICY "View households" ON households
  FOR SELECT USING (
    id IN (SELECT * FROM get_user_household_ids())
  );

-- 4. Apply policies to household_members
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT * FROM get_user_household_ids())
  );

DROP POLICY IF EXISTS "Admins can manage members" ON household_members;
CREATE POLICY "Admins can manage members" ON household_members
  FOR ALL USING (
    household_id IN (SELECT * FROM get_user_managed_household_ids())
  );

-- 5. Apply policies to profiles (Fixes 403 Errors)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "View household member profiles" ON profiles;
CREATE POLICY "View household member profiles" ON profiles
  FOR SELECT USING (
    id IN (SELECT * FROM get_all_household_members_user_ids())
  );

-- 6. Apply policies to transactions (Safety)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View transactions" ON transactions;
CREATE POLICY "View transactions" ON transactions
  FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

DROP POLICY IF EXISTS "Manage transactions" ON transactions;
CREATE POLICY "Manage transactions" ON transactions
  FOR ALL USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );
