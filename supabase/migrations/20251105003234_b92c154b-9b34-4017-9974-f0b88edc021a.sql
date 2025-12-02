-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create households table
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Create household_members junction table
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(household_id, user_id)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Add household_id to transactions
ALTER TABLE public.transactions ADD COLUMN household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

-- Add household_id to monthly_budgets
ALTER TABLE public.monthly_budgets ADD COLUMN household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

-- Security definer function to check household membership
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
  )
$$;

-- Security definer function to check if user is household admin
CREATE OR REPLACE FUNCTION public.is_household_admin(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for households
CREATE POLICY "Users can view households they belong to"
  ON public.households FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = households.id
        AND household_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their households"
  ON public.households FOR UPDATE
  USING (public.is_household_admin(auth.uid(), id));

CREATE POLICY "Admins can delete their households"
  ON public.households FOR DELETE
  USING (public.is_household_admin(auth.uid(), id));

-- RLS Policies for household_members
CREATE POLICY "Users can view members of their households"
  ON public.household_members FOR SELECT
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Admins can add members to their households"
  ON public.household_members FOR INSERT
  WITH CHECK (public.is_household_admin(auth.uid(), household_id));

CREATE POLICY "Admins can update members in their households"
  ON public.household_members FOR UPDATE
  USING (public.is_household_admin(auth.uid(), household_id));

CREATE POLICY "Admins can remove members from their households"
  ON public.household_members FOR DELETE
  USING (public.is_household_admin(auth.uid(), household_id));

-- Update RLS policies for transactions to support household access
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Household members can view transactions"
  ON public.transactions FOR SELECT
  USING (
    auth.uid() = user_id OR 
    public.is_household_member(auth.uid(), household_id)
  );

CREATE POLICY "Household members can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (household_id IS NULL OR public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can update transactions"
  ON public.transactions FOR UPDATE
  USING (
    auth.uid() = user_id OR
    public.is_household_member(auth.uid(), household_id)
  );

CREATE POLICY "Household members can delete transactions"
  ON public.transactions FOR DELETE
  USING (
    auth.uid() = user_id OR
    public.is_household_member(auth.uid(), household_id)
  );

-- Update RLS policies for monthly_budgets to support household access
DROP POLICY IF EXISTS "Users can view own budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.monthly_budgets;

CREATE POLICY "Household members can view budgets"
  ON public.monthly_budgets FOR SELECT
  USING (
    auth.uid() = user_id OR
    public.is_household_member(auth.uid(), household_id)
  );

CREATE POLICY "Household members can insert budgets"
  ON public.monthly_budgets FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (household_id IS NULL OR public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can update budgets"
  ON public.monthly_budgets FOR UPDATE
  USING (
    auth.uid() = user_id OR
    public.is_household_member(auth.uid(), household_id)
  );

CREATE POLICY "Household members can delete budgets"
  ON public.monthly_budgets FOR DELETE
  USING (
    auth.uid() = user_id OR
    public.is_household_member(auth.uid(), household_id)
  );

-- Trigger to add creator as admin when household is created
CREATE OR REPLACE FUNCTION public.add_household_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_household_created
  AFTER INSERT ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.add_household_creator_as_admin();

-- Update trigger for households
CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();