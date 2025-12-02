-- EMERGENCY FIX - Temporarily disable RLS to test, then re-enable with correct policies
-- Run this script to diagnose and fix the issue

-- First, let's check what policies exist
-- You can run this separately to see current policies:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('households', 'household_members');

-- ============================================
-- STEP 1: Completely reset households RLS
-- ============================================

-- Disable RLS temporarily
ALTER TABLE households DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "Users can view households they belong to" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "View households" ON households;
DROP POLICY IF EXISTS "Create households" ON households;
DROP POLICY IF EXISTS "Update households" ON households;
DROP POLICY IF EXISTS "Delete households" ON households;

-- Re-enable RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Create very permissive policies for testing
CREATE POLICY "households_select" ON households
    FOR SELECT USING (true);

CREATE POLICY "households_insert" ON households
    FOR INSERT WITH CHECK (true);

CREATE POLICY "households_update" ON households
    FOR UPDATE USING (true);

CREATE POLICY "households_delete" ON households
    FOR DELETE USING (true);

-- ============================================
-- STEP 2: Reset household_members RLS
-- ============================================

-- Disable RLS temporarily
ALTER TABLE household_members DISABLE ROW LEVEL SECURITY;

-- Drop all policies
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

-- Re-enable RLS
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Create very permissive policies for testing
CREATE POLICY "household_members_select" ON household_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "household_members_insert" ON household_members
    FOR INSERT WITH CHECK (true);

CREATE POLICY "household_members_update" ON household_members
    FOR UPDATE USING (true);

CREATE POLICY "household_members_delete" ON household_members
    FOR DELETE USING (true);

-- ============================================
-- STEP 3: Ensure trigger exists
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

-- ============================================
-- NOTE: These are VERY PERMISSIVE policies for testing
-- After confirming household creation works, you should
-- tighten these policies for production use
-- ============================================
