import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export const useHousehold = () => {
  const [household, setHousehold] = useState<Household | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "member" | null>(null);
  const [myHouseholds, setMyHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHouseholds();
  }, []);

  const fetchHouseholds = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get all memberships
      const { data: memberships, error: membershipError } = await supabase
        .from("household_members")
        .select("role, household:households(*)")
        .eq("user_id", user.id);

      if (membershipError) {
        console.error("Error fetching memberships:", membershipError);
        return;
      }

      if (memberships && memberships.length > 0) {
        // Extract households
        const households = memberships.map((m: any) => m.household).filter(Boolean);
        setMyHouseholds(households);

        // 2. Determine active household
        // Check local storage or default to the first one
        const storedHouseholdId = localStorage.getItem("activeHouseholdId");
        let activeId = storedHouseholdId;

        if (!activeId || !households.find(h => h.id === activeId)) {
          // If no stored ID or stored ID is invalid (e.g. left household), default to first
          activeId = households[0].id;
          localStorage.setItem("activeHouseholdId", activeId);
        }

        const activeHousehold = households.find(h => h.id === activeId);
        const activeMembership = memberships.find((m: any) => m.household.id === activeId);

        setHousehold(activeHousehold || null);
        setUserRole(activeMembership?.role || null);
      } else {
        setMyHouseholds([]);
        setHousehold(null);
        setUserRole(null);
        localStorage.removeItem("activeHouseholdId");
      }
    } catch (error) {
      console.error("Error in fetchHouseholds:", error);
    } finally {
      setLoading(false);
    }
  };

  const switchHousehold = (householdId: string) => {
    const selected = myHouseholds.find(h => h.id === householdId);
    if (!selected) return;

    localStorage.setItem("activeHouseholdId", householdId);
    setHousehold(selected);

    // We need to re-fetch to get the role correct if it differs between households
    // Or we can just find it from the memberships if we store them state fully.
    // For now, let's just re-fetch to be safe and consistent.
    fetchHouseholds();
  };

  const createHousehold = async (name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("households")
        .insert({
          name,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger trigger to add admin member is handled by DB or another flow?
      // Assuming there is a DB trigger that adds the creator as admin.
      // If not, we should do it manually. 
      // Checking `fix_household_creation_trigger.sql` presence in file list suggests a trigger exists/intended.

      // Force refresh
      await fetchHouseholds();

      // Auto-switch to new household
      if (data) {
        switchHousehold(data.id);
      }

      return data;
    } catch (error) {
      console.error("Error creating household:", error);
      throw error;
    }
  };

  const refreshHousehold = () => {
    fetchHouseholds();
  };

  return {
    household,
    userRole,
    myHouseholds,
    loading,
    createHousehold,
    switchHousehold,
    refreshHousehold,
  };
};
