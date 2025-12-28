-- ============================================
-- FIX INFINITE RECURSION IN RLS
-- ============================================

-- 1. Create a privileged view to break recursion
-- This view acts as a bypass for RLS when queried by the secure function
CREATE OR REPLACE VIEW rls_members_view AS
SELECT * FROM household_members;

-- IMPORTANT: Secure the view so normal users can't access it directly
REVOKE ALL ON rls_members_view FROM authenticated, anon, public;
-- Access is only via the function below

-- 2. Update the helper function to use the VIEW
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS TABLE (household_id UUID) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Query the view to avoid triggering the table's RLS policy recursively
  RETURN QUERY SELECT m.household_id 
  FROM rls_members_view m 
  WHERE m.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_user_household_ids TO authenticated, service_role;

-- ============================================
-- 3. Reset and Apply Policies
-- ============================================

-- A. household_members (The tricky one)
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Drop all potentially conflicting policies
DROP POLICY IF EXISTS "View own membership" ON household_members;
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
DROP POLICY IF EXISTS "Members can view other members" ON household_members;
DROP POLICY IF EXISTS "Admins can manage members" ON household_members;
DROP POLICY IF EXISTS "Users can leave household" ON household_members;

-- New Policies
CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT * FROM get_user_household_ids())
  );

CREATE POLICY "Admins can manage members" ON household_members
  FOR ALL USING (
    household_id IN (
        SELECT m.household_id 
        FROM rls_members_view m -- Use view here too for safety/speed
        WHERE m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

CREATE POLICY "Users can leave household" ON household_members
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- B. Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Manage transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage transactions" ON transactions;

CREATE POLICY "View transactions" ON transactions
  FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

CREATE POLICY "Manage transactions" ON transactions
  FOR ALL USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- C. Monthly Budgets
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View budgets" ON monthly_budgets;
DROP POLICY IF EXISTS "Manage budgets" ON monthly_budgets;

CREATE POLICY "View budgets" ON monthly_budgets
  FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

CREATE POLICY "Manage budgets" ON monthly_budgets
  FOR ALL USING (
    user_id = auth.uid() 
    OR 
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- D. Households
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View households" ON households;
DROP POLICY IF EXISTS "Create households" ON households;
DROP POLICY IF EXISTS "Update households" ON households;
DROP POLICY IF EXISTS "Delete households" ON households;

CREATE POLICY "View households" ON households
  FOR SELECT USING (
    id IN (SELECT * FROM get_user_household_ids())
  );

CREATE POLICY "Create households" ON households
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

CREATE POLICY "Update households" ON households
  FOR UPDATE USING (
    id IN (
        SELECT m.household_id 
        FROM rls_members_view m 
        WHERE m.user_id = auth.uid() AND m.role = 'admin'
    )
  );
