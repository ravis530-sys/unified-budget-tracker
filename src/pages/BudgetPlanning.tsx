import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Target } from "lucide-react";
import BudgetCategoryList from "@/components/BudgetCategoryList";
import AddBudgetDialog from "@/components/AddBudgetDialog";
import HouseholdSetupDialog from "@/components/HouseholdSetupDialog";
import { useHousehold } from "@/hooks/useHousehold";

const BudgetPlanning = () => {
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scope, setScope] = useState<"individual" | "family">("individual");
  const [showHouseholdSetup, setShowHouseholdSetup] = useState(false);
  const { household, createHousehold, refreshHousehold } = useHousehold();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleBudgetAdded = () => {
    setShowAddDialog(false);
    setRefreshKey(prev => prev + 1);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Goal Planning</h1>
            <p className="text-xs text-muted-foreground">Manage your income and expense goals</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Your Goals</h2>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        <Tabs value={scope} onValueChange={handleScopeChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
          </TabsList>

          <TabsContent value={scope} className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Income Goals</CardTitle>
                  <CardDescription>
                    Planned income sources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetCategoryList
                    key={`income-${refreshKey}-${scope}`}
                    type="income"
                    viewMode="goals"
                    onUpdate={() => setRefreshKey(prev => prev + 1)}
                    scope={scope}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expense Goals</CardTitle>
                  <CardDescription>
                    Planned expense limits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetCategoryList
                    key={`expense-${refreshKey}-${scope}`}
                    type="expense"
                    viewMode="goals"
                    onUpdate={() => setRefreshKey(prev => prev + 1)}
                    scope={scope}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AddBudgetDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleBudgetAdded}
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

export default BudgetPlanning;
