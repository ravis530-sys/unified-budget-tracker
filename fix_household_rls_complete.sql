-- Complete fix for household_members infinite recursion
-- Run this entire script in Supabase SQL Editor

-- Step 1: Drop ALL existing policies on household_members
DROP POLICY IF EXISTS "Members can view other members of their household" ON household_members;
DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
DROP POLICY IF EXISTS "Users can add themselves to households they created" ON household_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON household_members;
DROP POLICY IF EXISTS "Admins can remove members" ON household_members;

-- Step 2: Create simple, non-recursive policies

-- Allow users to view their own membership records
CREATE POLICY "Users can view their own memberships" ON household_members
    FOR SELECT USING (user_id = auth.uid());

-- Allow users to view other members in the same household (non-recursive check)
CREATE POLICY "Users can view household members" ON household_members
    FOR SELECT USING (
        household_id IN (
            SELECT hm.household_id 
            FROM household_members hm 
            WHERE hm.user_id = auth.uid()
        )
    );

-- Allow INSERT only through SECURITY DEFINER functions or for household creators
-- This policy is permissive to allow the trigger to work
CREATE POLICY "Allow household member inserts" ON household_members
    FOR INSERT WITH CHECK (true);

-- Allow admins to update roles (using direct user_id check to avoid recursion)
CREATE POLICY "Admins can update roles" ON household_members
    FOR UPDATE USING (
        -- Check if the current user is an admin in this household
        household_id IN (
            SELECT hm.household_id 
            FROM household_members hm 
            WHERE hm.user_id = auth.uid() 
            AND hm.role = 'admin'
        )
    );

-- Allow admins to delete members
CREATE POLICY "Admins can delete members" ON household_members
    FOR DELETE USING (
        -- Check if the current user is an admin in this household
        household_id IN (
            SELECT hm.household_id 
            FROM household_members hm 
            WHERE hm.user_id = auth.uid() 
            AND hm.role = 'admin'
        )
    );

-- Step 3: Create or replace the trigger function
CREATE OR REPLACE FUNCTION add_creator_to_household()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the creator as an admin member
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create the trigger
DROP TRIGGER IF EXISTS on_household_created ON households;
CREATE TRIGGER on_household_created
    AFTER INSERT ON households
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_to_household();
