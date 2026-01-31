import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import BudgetPlanning from "./pages/BudgetPlanning";
import HouseholdSettings from "./pages/HouseholdSettings";
import AcceptInvite from "./pages/AcceptInvite";
import GoalAllocation from "./pages/GoalAllocation";
import NotFound from "./pages/NotFound";
import { supabase } from "@/integrations/supabase/client";

import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Global auth listener to handle token refresh failures
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        console.error("Token refresh failed globally. Clearing session.");
        // Local only signout to avoid network loops
        localStorage.removeItem("supabase.auth.token");
        window.location.href = "/auth";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/budget-planning" element={<BudgetPlanning />} />
            <Route path="/household-settings" element={<HouseholdSettings />} />
            <Route path="/accept-invite/:token" element={<AcceptInvite />} />
            <Route path="/goal-allocation" element={<GoalAllocation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
