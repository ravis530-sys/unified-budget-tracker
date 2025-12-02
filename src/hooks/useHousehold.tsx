import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface HouseholdMember {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHousehold();
  }, []);

  const fetchHousehold = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, get user's household membership (simple query, no joins)
      const { data: membership, error: membershipError } = await supabase
        .from("household_members")
        .select("role, household_id")
        .eq("user_id", user.id)
        .single();

      if (membershipError) {
        if (membershipError.code !== "PGRST116") {
          console.error("Error fetching household:", membershipError);
        }
        return;
      }

      if (membership) {
        // Then fetch the household details separately
        const { data: householdData, error: householdError } = await supabase
          .from("households")
          .select("*")
          .eq("id", membership.household_id)
          .single();

        if (householdError) {
          console.error("Error fetching household details:", householdError);
          return;
        }

        setHousehold(householdData);
        setUserRole(membership.role);
      }
    } catch (error) {
      console.error("Error in fetchHousehold:", error);
    } finally {
      setLoading(false);
    }
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

      await fetchHousehold();
      return data;
    } catch (error) {
      console.error("Error creating household:", error);
      throw error;
    }
  };

  const refreshHousehold = () => {
    fetchHousehold();
  };

  return {
    household,
    userRole,
    loading,
    createHousehold,
    refreshHousehold,
  };
};
