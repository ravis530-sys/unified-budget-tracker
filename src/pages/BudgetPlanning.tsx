import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import BudgetMonthSelector from "@/components/BudgetMonthSelector";
import BudgetCategoryList from "@/components/BudgetCategoryList";
import AddBudgetDialog from "@/components/AddBudgetDialog";
import BudgetSummary from "@/components/BudgetSummary";
import BudgetAllocationBreakdown from "@/components/BudgetAllocationBreakdown";
import BudgetIncomeAllocation from "@/components/BudgetIncomeAllocation";
import HouseholdSetupDialog from "@/components/HouseholdSetupDialog";
import { useHousehold } from "@/hooks/useHousehold";
import { format } from "date-fns";

const BudgetPlanning = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
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
            <h1 className="text-xl font-bold">Budget Planning</h1>
            <p className="text-xs text-muted-foreground">Plan your monthly budget</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <BudgetMonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </div>

        <Tabs value={scope} onValueChange={handleScopeChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
          </TabsList>

          <TabsContent value={scope} className="space-y-6 mt-6">
            <BudgetSummary
              key={`${refreshKey}-${scope}`}
              selectedMonth={selectedMonth}
              scope={scope}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Planned Income</CardTitle>
                  <CardDescription>
                    Expected earnings for {format(selectedMonth, "MMMM yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetCategoryList
                    key={`income-${refreshKey}-${scope}`}
                    type="income"
                    selectedMonth={selectedMonth}
                    onUpdate={() => setRefreshKey(prev => prev + 1)}
                    scope={scope}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Planned Expenses</CardTitle>
                  <CardDescription>
                    Budgeted spending for {format(selectedMonth, "MMMM yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetCategoryList
                    key={`expense-${refreshKey}-${scope}`}
                    type="expense"
                    selectedMonth={selectedMonth}
                    onUpdate={() => setRefreshKey(prev => prev + 1)}
                    scope={scope}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Budget Allocation</CardTitle>
                <CardDescription>
                  Allocate your planned income to expense categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BudgetIncomeAllocation
                  key={`allocation-${refreshKey}-${scope}`}
                  selectedMonth={selectedMonth}
                  onUpdate={() => setRefreshKey(prev => prev + 1)}
                  scope={scope}
                />
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Income Breakdown</CardTitle>
                  <CardDescription>
                    Planned vs Actual for {format(selectedMonth, "MMMM yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetAllocationBreakdown
                    key={`income-breakdown-${refreshKey}-${scope}`}
                    selectedMonth={selectedMonth}
                    type="income"
                    scope={scope}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>
                    Planned vs Actual for {format(selectedMonth, "MMMM yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetAllocationBreakdown
                    key={`expense-breakdown-${refreshKey}-${scope}`}
                    selectedMonth={selectedMonth}
                    type="expense"
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
        selectedMonth={selectedMonth}
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
