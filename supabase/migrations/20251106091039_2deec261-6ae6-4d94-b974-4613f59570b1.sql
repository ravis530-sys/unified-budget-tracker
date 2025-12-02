-- Drop the existing policy
DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;

-- Create a simpler policy that allows authenticated users to insert
CREATE POLICY "Authenticated users can create households" 
ON public.households 
FOR INSERT 
TO authenticated
WITH CHECK (true);