-- Fix households table RLS policies
-- The INSERT policy needs to allow users to create households

-- Drop existing households policies
DROP POLICY IF EXISTS "Users can view households they belong to" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;

-- Allow users to view households they are members of
CREATE POLICY "View households" ON households
    FOR SELECT USING (
        id IN (
            SELECT household_id 
            FROM household_members 
            WHERE user_id = auth.uid()
        )
    );

-- Allow any authenticated user to create a household
CREATE POLICY "Create households" ON households
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND created_by = auth.uid()
    );

-- Allow household creators to update their household
CREATE POLICY "Update households" ON households
    FOR UPDATE USING (created_by = auth.uid());

-- Allow household creators to delete their household
CREATE POLICY "Delete households" ON households
    FOR DELETE USING (created_by = auth.uid());
