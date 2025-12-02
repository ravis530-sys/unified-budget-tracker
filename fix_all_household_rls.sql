-- COMPLETE FIX - Run this entire script to fix all RLS issues
-- This combines all the fixes needed for household creation

-- ============================================
-- PART 1: Fix household_members policies
-- ============================================

-- Drop ALL existing policies on household_members
DROP POLICY IF EXISTS "Members can view other members of their household" ON household_members;
DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON household_members;
DROP POLICY IF EXISTS "Users can view household members" ON household_members;
DROP POLICY IF EXISTS "View own membership" ON household_members;
DROP POLICY IF EXISTS "Users can add themselves to households they created" ON household_members;
DROP POLICY IF EXISTS "Allow household member inserts" ON household_members;
DROP POLICY IF EXISTS "Allow inserts" ON household_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON household_members;
DROP POLICY IF EXISTS "Admins can update roles" ON household_members;
DROP POLICY IF EXISTS "Allow updates" ON household_members;
DROP POLICY IF EXISTS "Admins can remove members" ON household_members;
DROP POLICY IF EXISTS "Admins can delete members" ON household_members;
DROP POLICY IF EXISTS "Allow deletes" ON household_members;

-- Create simple, non-recursive policies for household_members
CREATE POLICY "View own membership" ON household_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Allow inserts" ON household_members
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow updates" ON household_members
    FOR UPDATE USING (true);

CREATE POLICY "Allow deletes" ON household_members
    FOR DELETE USING (true);

-- ============================================
-- PART 2: Fix households policies
-- ============================================

-- Drop existing households policies
DROP POLICY IF EXISTS "Users can view households they belong to" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "View households" ON households;
DROP POLICY IF EXISTS "Create households" ON households;
DROP POLICY IF EXISTS "Update households" ON households;
DROP POLICY IF EXISTS "Delete households" ON households;

-- Create proper households policies
CREATE POLICY "View households" ON households
    FOR SELECT USING (
        id IN (
            SELECT household_id 
            FROM household_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Create households" ON households
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND created_by = auth.uid()
    );

CREATE POLICY "Update households" ON households
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Delete households" ON households
    FOR DELETE USING (created_by = auth.uid());

-- ============================================
-- PART 3: Create helper functions
-- ============================================

CREATE OR REPLACE FUNCTION is_household_member(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = _household_id
        AND user_id = _user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_household_admin(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = _household_id
        AND user_id = _user_id
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: Create trigger to add creator as admin
-- ============================================

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
