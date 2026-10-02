-- Create investment_instruments table to define user-specified Mutual Funds, Stocks, ETFs, etc.
CREATE TABLE IF NOT EXISTS public.investment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  code_or_ticker TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.investment_instruments ENABLE ROW LEVEL SECURITY;

-- RLS policies for investment_instruments
CREATE POLICY "Household members can view investment instruments"
  ON public.investment_instruments FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can insert investment instruments"
  ON public.investment_instruments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (household_id IS NULL OR public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can update investment instruments"
  ON public.investment_instruments FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can delete investment instruments"
  ON public.investment_instruments FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

-- Create trigger for investment_instruments updated_at
DROP TRIGGER IF EXISTS update_investment_instruments_updated_at ON public.investment_instruments;
CREATE TRIGGER update_investment_instruments_updated_at
BEFORE UPDATE ON public.investment_instruments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_investment_instruments_user ON public.investment_instruments(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_instruments_household ON public.investment_instruments(household_id);
CREATE INDEX IF NOT EXISTS idx_investment_instruments_category ON public.investment_instruments(category);


-- Create investment_sub_allocations table to track monthly splits across instruments
CREATE TABLE IF NOT EXISTS public.investment_sub_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  category TEXT NOT NULL,
  instrument_id UUID REFERENCES public.investment_instruments(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_month_instrument UNIQUE(user_id, month_year, instrument_id)
);

-- Enable Row Level Security
ALTER TABLE public.investment_sub_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for investment_sub_allocations
CREATE POLICY "Household members can view investment sub-allocations"
  ON public.investment_sub_allocations FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can insert investment sub-allocations"
  ON public.investment_sub_allocations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (household_id IS NULL OR public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can update investment sub-allocations"
  ON public.investment_sub_allocations FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Household members can delete investment sub-allocations"
  ON public.investment_sub_allocations FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  );

-- Create trigger for investment_sub_allocations updated_at
DROP TRIGGER IF EXISTS update_investment_sub_allocations_updated_at ON public.investment_sub_allocations;
CREATE TRIGGER update_investment_sub_allocations_updated_at
BEFORE UPDATE ON public.investment_sub_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sub_allocations_user_month ON public.investment_sub_allocations(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_sub_allocations_household_month ON public.investment_sub_allocations(household_id, month_year);
CREATE INDEX IF NOT EXISTS idx_sub_allocations_instrument ON public.investment_sub_allocations(instrument_id);
