-- ============================================
-- FIX RLS VISIBILITY ISSUES
-- ============================================

-- 1. Create a secure helper function to get user's households
-- This avoids infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS TABLE (household_id UUID) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT m.household_id 
  FROM household_members m 
  WHERE m.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_user_household_ids TO authenticated, service_role;

-- ============================================
-- 2. Fix household_members policies
-- ============================================

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own membership" ON household_members;
DROP POLICY IF EXISTS "Members can view other members" ON household_members;
DROP POLICY IF EXISTS "Admins can manage members" ON household_members;

-- Allow users to view ALL members of households they belong to
CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- Allow admins to insert/update/delete members
CREATE POLICY "Admins can manage members" ON household_members
  FOR ALL USING (
    household_id IN (
        SELECT m.household_id 
        FROM household_members m 
        WHERE m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

-- Allow users to delete THEIR OWN membership (leave household)
CREATE POLICY "Users can leave household" ON household_members
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ============================================
-- 3. Fix transactions policies
-- ============================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage transactions" ON transactions;

-- View: Own transactions OR Any transaction in a household I belong to
CREATE POLICY "View transactions" ON transactions
  FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- Manage: Own transactions OR Any transaction in a household I belong to
CREATE POLICY "Manage transactions" ON transactions
  FOR ALL USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- ============================================
-- 4. Fix monthly_budgets policies
-- ============================================

ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View budgets" ON monthly_budgets;
DROP POLICY IF EXISTS "Manage budgets" ON monthly_budgets;

-- View
CREATE POLICY "View budgets" ON monthly_budgets
  FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- Manage
CREATE POLICY "Manage budgets" ON monthly_budgets
  FOR ALL USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- ============================================
-- 5. Fix households policies
-- ============================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View households" ON households;
DROP POLICY IF EXISTS "Create households" ON households;
DROP POLICY IF EXISTS "Update households" ON households;

-- View households I belong to
CREATE POLICY "View households" ON households
  FOR SELECT USING (
    id IN (SELECT * FROM get_user_household_ids())
  );

-- Create households (anyone authenticated)
CREATE POLICY "Create households" ON households
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

-- Update households (Admins only)
CREATE POLICY "Update households" ON households
  FOR UPDATE USING (
    id IN (
        SELECT m.household_id 
        FROM household_members m 
        WHERE m.user_id = auth.uid() AND m.role = 'admin'
    )
  );
