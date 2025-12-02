import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Plus, Wallet as WalletIcon, CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import TransactionList from "@/components/TransactionList";
import DashboardStats from "@/components/DashboardStats";
import ExpenseChart from "@/components/ExpenseChart";
import BudgetAllocationBreakdown from "@/components/BudgetAllocationBreakdown";
import HouseholdSetupDialog from "@/components/HouseholdSetupDialog";
import { useHousehold } from "@/hooks/useHousehold";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editTransaction, setEditTransaction] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scope, setScope] = useState<"individual" | "family">("individual");
  const [showHouseholdSetup, setShowHouseholdSetup] = useState(false);
  const navigate = useNavigate();
  const { household, createHousehold, refreshHousehold } = useHousehold();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  const handleTransactionAdded = () => {
    setShowAddDialog(false);
    setEditTransaction(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleEditTransaction = (transaction: any) => {
    setEditTransaction(transaction);
    setShowAddDialog(true);
  };

  const handleScopeChange = (newScope: "individual" | "family") => {
    if (newScope === "family" && !household) {
      setShowHouseholdSetup(true);
      return;
    }
    setScope(newScope);
  };

  const handleHouseholdCreated = () => {
    setShowHouseholdSetup(false);
    refreshHousehold();
    setScope("family");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <WalletIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">BudgetTrack</h1>
              <p className="text-xs text-muted-foreground">Track your finances</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/budget-planning")} title="Budget Planning">
              <CalendarDays className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/household-settings")} title="Family Settings">
              <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground">Overview of your finances</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>

        <Tabs value={scope} onValueChange={handleScopeChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
          </TabsList>

          <TabsContent value={scope} className="space-y-6 mt-6">
            <DashboardStats key={`${refreshKey}-${scope}`} scope={scope} />

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Budget Overview</CardTitle>
                  <CardDescription>Current month allocations</CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetAllocationBreakdown
                    key={`budget-${refreshKey}-${scope}`}
                    selectedMonth={new Date()}
                    type="expense"
                    scope={scope}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>Distribution by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpenseChart key={`${refreshKey}-${scope}`} scope={scope} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest activity</CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionList key={`${refreshKey}-${scope}`} limit={5} onEdit={handleEditTransaction} scope={scope} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AddTransactionDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) setEditTransaction(null);
        }}
        onSuccess={handleTransactionAdded}
        transaction={editTransaction}
        scope={scope}
      />

      <HouseholdSetupDialog
        open={showHouseholdSetup}
        onSuccess={handleHouseholdCreated}
        onCreateHousehold={createHousehold}
      />
    </div>
  );
};

export default Dashboard;
