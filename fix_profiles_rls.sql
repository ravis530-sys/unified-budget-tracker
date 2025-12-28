-- ============================================
-- FIX PROFILES VISIBILITY
-- Resolves "Unknown User" issue
-- ============================================

-- Enable RLS on profiles if not already on
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies regarding SELECT/read
-- (We'll leave update/insert policies alone as they are likely fine: users edit their own)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "View household member profiles" ON profiles;

-- 1. Allow users to see their OWN profile (essential)
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (
    id = auth.uid()
  );

-- 2. Allow users to see profiles of PEOPLE IN THEIR HOUSEHOLDS
-- This uses the helper function from the previous script
CREATE POLICY "View household member profiles" ON profiles
  FOR SELECT USING (
    id IN (
        SELECT m.user_id 
        FROM household_members m
        WHERE m.household_id IN (SELECT * FROM get_user_household_ids())
    )
  );

-- Note: We keep "Update own profile" policies if they exist. 
-- Usually they look like:
-- CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
-- CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
