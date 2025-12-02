-- Fix infinite recursion in household_members RLS policies
-- This script drops the problematic policy and creates better ones

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Members can view other members of their household" ON household_members;

-- Create a simpler SELECT policy that doesn't cause recursion
-- Users can view household_members records where they are a member
CREATE POLICY "Users can view members of their households" ON household_members
    FOR SELECT USING (
        user_id = auth.uid() 
        OR household_id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to insert themselves as members when creating a household
-- This is needed for the household creation flow
CREATE POLICY "Users can add themselves to households they created" ON household_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND (
            -- Allow if they're the creator of the household
            EXISTS (
                SELECT 1 FROM households 
                WHERE households.id = household_members.household_id 
                AND households.created_by = auth.uid()
            )
            -- OR if they're accepting an invitation (handled by accept_invitation function)
            OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        )
    );

-- Allow admins to update member roles
CREATE POLICY "Admins can update member roles" ON household_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM household_members AS admin_check
            WHERE admin_check.household_id = household_members.household_id
            AND admin_check.user_id = auth.uid()
            AND admin_check.role = 'admin'
        )
    );

-- Allow admins to remove members
CREATE POLICY "Admins can remove members" ON household_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM household_members AS admin_check
            WHERE admin_check.household_id = household_members.household_id
            AND admin_check.user_id = auth.uid()
            AND admin_check.role = 'admin'
        )
    );
