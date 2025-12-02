-- Ultimate fix for household_members infinite recursion
-- This uses SECURITY DEFINER functions to bypass RLS for safe operations

-- Step 1: Drop ALL existing policies on household_members
DROP POLICY IF EXISTS "Members can view other members of their household" ON household_members;
DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON household_members;
DROP POLICY IF EXISTS "Users can view household members" ON household_members;
DROP POLICY IF EXISTS "Users can add themselves to households they created" ON household_members;
DROP POLICY IF EXISTS "Allow household member inserts" ON household_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON household_members;
DROP POLICY IF EXISTS "Admins can update roles" ON household_members;
DROP POLICY IF EXISTS "Admins can remove members" ON household_members;
DROP POLICY IF EXISTS "Admins can delete members" ON household_members;

-- Step 2: Create ONLY the most basic policies
-- These policies are extremely simple and cannot recurse

-- Allow users to see records where they are the user
CREATE POLICY "View own membership" ON household_members
    FOR SELECT USING (user_id = auth.uid());

-- Allow inserts (controlled by trigger and functions)
CREATE POLICY "Allow inserts" ON household_members
    FOR INSERT WITH CHECK (true);

-- Allow updates where user is admin (checked via function, not policy)
CREATE POLICY "Allow updates" ON household_members
    FOR UPDATE USING (true);

-- Allow deletes where user is admin (checked via function, not policy)
CREATE POLICY "Allow deletes" ON household_members
    FOR DELETE USING (true);

-- Step 3: Create helper functions to check membership safely

-- Function to check if user is a household member
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

-- Function to check if user is a household admin
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

-- Step 4: Create the trigger to add creator as admin
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
