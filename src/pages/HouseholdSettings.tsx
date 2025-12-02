import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Crown, Trash2, Shield, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/hooks/useHousehold";
import InviteMemberDialog from "@/components/InviteMemberDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HouseholdMember {
  id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles: {
    full_name: string | null;
  } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "member";
  status: string;
  created_at: string;
}

const HouseholdSettings = () => {
  const navigate = useNavigate();
  const { household, userRole, loading: householdLoading } = useHousehold();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    checkAuth();
    if (household) {
      fetchMembers();
      fetchInvitations();
    }
  }, [household]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);
  };

  const fetchMembers = async () => {
    if (!household) return;

    try {
      const { data: membersData, error: membersError } = await supabase
        .from("household_members")
        .select("id, user_id, role, joined_at")
        .eq("household_id", household.id)
        .order("joined_at", { ascending: true });

      if (membersError) throw membersError;

      // Fetch profiles separately
      const userIds = membersData?.map(m => m.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      // Merge profiles with members
      const membersWithProfiles = membersData?.map(member => ({
        ...member,
        profiles: profilesData?.find(p => p.id === member.user_id) || null,
      }));

      setMembers(membersWithProfiles || []);
    } catch (error: any) {
      toast.error("Failed to load members");
      console.error(error);
    }
  };

  const fetchInvitations = async () => {
    if (!household) return;

    try {
      const { data, error } = await supabase
        .from("household_invitations")
        .select("*")
        .eq("household_id", household.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    }
  };

  const handleCancelInvite = async (id: string) => {
    try {
      const { error } = await supabase
        .from("household_invitations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Invitation cancelled");
      fetchInvitations();
    } catch (error: any) {
      toast.error("Failed to cancel invitation");
    }
  };

  const handlePromoteToAdmin = async (memberId: string) => {
    if (!household || userRole !== "admin") return;

    try {
      const { error } = await supabase
        .from("household_members")
        .update({ role: "admin" })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Member promoted to admin");
      fetchMembers();
    } catch (error: any) {
      toast.error("Failed to promote member");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !household || userRole !== "admin") return;

    try {
      const { error } = await supabase
        .from("household_members")
        .delete()
        .eq("id", memberToRemove);

      if (error) throw error;

      toast.success("Member removed");
      setMemberToRemove(null);
      fetchMembers();
    } catch (error: any) {
      toast.error("Failed to remove member");
    }
  };

  if (householdLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Household Found</CardTitle>
            <CardDescription>Please set up your household first</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Household Settings</h1>
                <p className="text-sm text-muted-foreground">{household.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {userRole === "admin" && (
            <div className="flex justify-end">
              <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </div>
          )}

          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>Invitations waiting to be accepted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{invite.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">{invite.role}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Family Members ({members.length})</CardTitle>
              <CardDescription>
                Manage household members and their roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {member.profiles?.full_name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.profiles?.full_name || "Unknown User"}
                          {member.user_id === currentUserId && (
                            <span className="text-xs text-muted-foreground ml-2">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {member.role === "admin" ? (
                            <>
                              <Crown className="h-3 w-3" />
                              Admin
                            </>
                          ) : (
                            <>
                              <Shield className="h-3 w-3" />
                              Member
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {userRole === "admin" && member.user_id !== currentUserId && (
                      <div className="flex gap-2">
                        {member.role === "member" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePromoteToAdmin(member.id)}
                          >
                            Make Admin
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMemberToRemove(member.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the household? They will lose
              access to all household data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InviteMemberDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        householdId={household.id}
        onSuccess={fetchInvitations}
      />
    </div>
  );
};

export default HouseholdSettings;
