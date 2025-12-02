-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create households" ON public.households;

-- Create a more permissive policy for authenticated users
CREATE POLICY "Authenticated users can create households" 
ON public.households 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);