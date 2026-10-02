import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Layers, Briefcase, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BudgetMonthSelector from "@/components/BudgetMonthSelector";
import { useHousehold } from "@/hooks/useHousehold";
import { MonthlySubAllocationView } from "@/components/MonthlySubAllocationView";
import { InvestmentInstrumentsManager } from "@/components/InvestmentInstrumentsManager";

const InvestmentAllocation = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { household } = useHousehold();

  // Tab & scope state
  const tabParam = searchParams.get("tab") || "sub-allocations";
  const categoryParam = searchParams.get("category") || "";

  const [activeTab, setActiveTab] = useState<string>(tabParam);
  const [scope, setScope] = useState<"individual" | "family">("individual");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [targetCategory, setTargetCategory] = useState<string>(categoryParam);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (categoryParam) {
      setTargetCategory(categoryParam);
    }
  }, [categoryParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("tab", val);
      return next;
    });
  };

  const handleNavigateToMaster = (category?: string) => {
    if (category) {
      setTargetCategory(category);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set("tab", "master-list");
        next.set("category", category);
        return next;
      });
    }
    setActiveTab("master-list");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* App Header matching design system */}
      <header className="border-b bg-[hsl(222,47%,11%)] text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate("/dashboard")}
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <h1 className="text-xl font-bold tracking-tight">Investment Sub-Allocation</h1>
              </div>
              <p className="text-xs text-white/70">
                Define portfolio instruments and split your monthly investment budget
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/20 bg-white/5 hover:bg-white/10 hover:text-white hidden sm:flex text-xs"
              onClick={() => navigate("/goal-allocation")}
            >
              Goal Allocation
            </Button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        {/* Scope Tabs & Month Selector */}
        <div className="flex flex-col items-center gap-4">
          <Tabs
            value={scope}
            onValueChange={(val) => setScope(val as "individual" | "family")}
            className="w-full max-w-[400px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="family" disabled={!household}>
                Family {(!household ? "(No Household)" : "")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <BudgetMonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>

        {/* Feature Tabs: Monthly Sub-Allocations vs Master Catalog */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="sub-allocations" className="gap-2 text-xs sm:text-sm">
              <Layers className="h-4 w-4" />
              Monthly Sub-Allocation
            </TabsTrigger>
            <TabsTrigger value="master-list" className="gap-2 text-xs sm:text-sm">
              <Briefcase className="h-4 w-4" />
              My Instruments Wishlist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sub-allocations" className="mt-0">
            <MonthlySubAllocationView
              selectedMonth={selectedMonth}
              scope={scope}
              initialCategory={targetCategory}
              onNavigateToMaster={handleNavigateToMaster}
            />
          </TabsContent>

          <TabsContent value="master-list" className="mt-0">
            <InvestmentInstrumentsManager
              scope={scope}
              defaultCategory={targetCategory}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default InvestmentAllocation;
