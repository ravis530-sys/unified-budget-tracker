-- ============================================
-- FINAL RLS FIX
-- Fixes both Recursive Loop AND Permission Errors
-- ============================================

-- 1. Ensure the View exists and is private
CREATE OR REPLACE VIEW rls_members_view AS
SELECT * FROM household_members;

-- Revoke all access to ensure it's only used by our secure functions
REVOKE ALL ON rls_members_view FROM authenticated, anon, public;

-- 2. Create Secure Helper Functions
-- These run as the function owner (superuser) to bypass RLS recursion

-- Get households the user is a MEMBER of
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS TABLE (household_id UUID) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT m.household_id 
  FROM rls_members_view m 
  WHERE m.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;

-- Get households the user is an ADMIN of
CREATE OR REPLACE FUNCTION get_admin_household_ids()
RETURNS TABLE (household_id UUID) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT m.household_id 
  FROM rls_members_view m 
  WHERE m.user_id = auth.uid() AND m.role = 'admin';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to everyone
GRANT EXECUTE ON FUNCTION get_user_household_ids TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_household_ids TO authenticated, service_role;


-- 3. Household Creator Trigger
-- Ensures new households get an admin member immediately
CREATE OR REPLACE FUNCTION add_creator_to_household()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_household_created ON households;
CREATE TRIGGER on_household_created
    AFTER INSERT ON households
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_to_household();


-- ============================================
-- 4. Apply Correct Policies
-- ============================================

-- A. Household Members
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
DROP POLICY IF EXISTS "Admins can manage members" ON household_members;
DROP POLICY IF EXISTS "Users can leave household" ON household_members;
-- cleanup old ones
DROP POLICY IF EXISTS "View own membership" ON household_members; 
DROP POLICY IF EXISTS "Members can view other members" ON household_members;

CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT * FROM get_user_household_ids())
  );

-- Fixed: Use function instead of direct view access
CREATE POLICY "Admins can manage members" ON household_members
  FOR ALL USING (
    household_id IN (SELECT * FROM get_admin_household_ids())
  );

CREATE POLICY "Users can leave household" ON household_members
  FOR DELETE USING (
    user_id = auth.uid()
  );


-- B. Households
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View households" ON households;
DROP POLICY IF EXISTS "Create households" ON households;
DROP POLICY IF EXISTS "Update households" ON households;

CREATE POLICY "View households" ON households
  FOR SELECT USING (
    id IN (SELECT * FROM get_user_household_ids())
  );

CREATE POLICY "Create households" ON households
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

-- Fixed: Use admin function
CREATE POLICY "Update households" ON households
  FOR UPDATE USING (
    id IN (SELECT * FROM get_admin_household_ids())
  );


-- C. Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View transactions" ON transactions;
DROP POLICY IF EXISTS "Manage transactions" ON transactions;

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


-- D. Monthly Budgets
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
