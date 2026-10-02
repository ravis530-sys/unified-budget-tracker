import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths } from "date-fns";
import { useHousehold } from "@/hooks/useHousehold";
import { INVESTMENT_CATEGORIES } from "@/lib/constants";
import { InvestmentInstrument } from "./InvestmentInstrumentsManager";
import {
  TrendingUp,
  Plus,
  Trash2,
  Copy,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  PieChart,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export interface InvestmentSubAllocation {
  id: string;
  user_id: string;
  household_id: string | null;
  month_year: string;
  category: string;
  instrument_id: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  instrument?: InvestmentInstrument;
}

interface MonthlySubAllocationViewProps {
  selectedMonth: Date;
  scope: "individual" | "family";
  initialCategory?: string;
  onNavigateToMaster: (category?: string) => void;
}

export const MonthlySubAllocationView = ({
  selectedMonth,
  scope,
  initialCategory,
  onNavigateToMaster,
}: MonthlySubAllocationViewProps) => {
  const navigate = useNavigate();
  const { household } = useHousehold();
  const [loading, setLoading] = useState(false);

  // Category selection
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || "Mutual Funds (MF)"
  );

  // Category allocated totals from budget_allocations
  const [categoryAllocations, setCategoryAllocations] = useState<Record<string, number>>({});

  // Defined master instruments
  const [instruments, setInstruments] = useState<InvestmentInstrument[]>([]);

  // Sub-allocations for this month
  const [subAllocations, setSubAllocations] = useState<InvestmentSubAllocation[]>([]);

  // Add sub-allocation modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Inline editing state: instrument_id -> string
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Copy previous month state
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (initialCategory && INVESTMENT_CATEGORIES.includes(initialCategory)) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, scope, household]);

  const monthStr = format(selectedMonth, "yyyy-MM-01");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const householdId = scope === "family" && household ? household.id : null;

      // 1. Fetch budget_allocations for this month
      let allocQuery = supabase
        .from("budget_allocations")
        .select(`
          allocated_amount,
          month_year,
          expense_budget:monthly_budgets!budget_allocations_expense_budget_id_fkey(
            category,
            household_id
          )
        `)
        .eq("month_year", monthStr);

      const { data: allocData, error: allocError } = await allocQuery;
      if (allocError) throw allocError;

      // Group allocations by category, respecting scope
      const catTotals: Record<string, number> = {};
      INVESTMENT_CATEGORIES.forEach(cat => { catTotals[cat] = 0; });

      (allocData || []).forEach((alloc: any) => {
        const cat = alloc.expense_budget?.category;
        const bHouseholdId = alloc.expense_budget?.household_id;

        // Scope check
        const matchesScope = scope === "family" && household
          ? bHouseholdId === household.id
          : !bHouseholdId;

        if (cat && INVESTMENT_CATEGORIES.includes(cat) && matchesScope) {
          catTotals[cat] = (catTotals[cat] || 0) + Number(alloc.allocated_amount || 0);
        }
      });
      setCategoryAllocations(catTotals);

      // 2. Fetch master instruments for this scope
      let instQuery = supabase
        .from("investment_instruments")
        .select("*")
        .order("name", { ascending: true });

      if (householdId) {
        instQuery = instQuery.eq("household_id", householdId);
      } else {
        instQuery = instQuery.is("household_id", null).eq("user_id", user.id);
      }

      const { data: instData, error: instError } = await instQuery;
      if (instError) throw instError;
      setInstruments((instData as InvestmentInstrument[]) || []);

      // 3. Fetch sub_allocations for this month and scope
      let subQuery = supabase
        .from("investment_sub_allocations")
        .select(`
          *,
          instrument:investment_instruments(*)
        `)
        .eq("month_year", monthStr);

      if (householdId) {
        subQuery = subQuery.eq("household_id", householdId);
      } else {
        subQuery = subQuery.is("household_id", null).eq("user_id", user.id);
      }

      const { data: subData, error: subError } = await subQuery;
      if (subError) throw subError;

      const loadedSubs = (subData as InvestmentSubAllocation[]) || [];
      setSubAllocations(loadedSubs);

      // Initialize inline edit amounts
      const amountsMap: Record<string, string> = {};
      loadedSubs.forEach(s => {
        amountsMap[s.id] = s.amount.toString();
      });
      setEditingAmounts(amountsMap);

    } catch (err: any) {
      console.error("Error fetching sub-allocation data:", err);
      toast.error("Failed to load sub-allocation data");
    } finally {
      setLoading(false);
    }
  };

  // Sub-allocations for currently selected category
  const currentCategorySubs = subAllocations.filter(s => s.category === selectedCategory);

  // Available master instruments for this category that haven't been sub-allocated yet
  const availableInstrumentsForCategory = instruments.filter(
    inst => inst.category === selectedCategory &&
      inst.is_active &&
      !currentCategorySubs.some(s => s.instrument_id === inst.id)
  );

  // Financial calculations
  const totalAllocatedToCategory = categoryAllocations[selectedCategory] || 0;
  const totalSubAllocated = currentCategorySubs.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const remainingToSubAllocate = totalAllocatedToCategory - totalSubAllocated;
  const pctSubAllocated = totalAllocatedToCategory > 0
    ? Math.min(Math.round((totalSubAllocated / totalAllocatedToCategory) * 100), 100)
    : 0;

  // Add new sub-allocation
  const handleAddSubAllocation = async () => {
    if (!selectedInstrumentId) {
      toast.error("Please select an instrument");
      return;
    }
    const numAmount = parseFloat(addAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const householdId = scope === "family" && household ? household.id : null;

      const { error } = await supabase
        .from("investment_sub_allocations")
        .insert({
          user_id: user.id,
          household_id: householdId,
          month_year: monthStr,
          category: selectedCategory,
          instrument_id: selectedInstrumentId,
          amount: numAmount,
          notes: addNotes.trim() || null,
        });

      if (error) throw error;

      toast.success("Sub-allocation added");
      setIsAddModalOpen(false);
      setSelectedInstrumentId("");
      setAddAmount("");
      setAddNotes("");
      fetchData();
    } catch (err: any) {
      console.error("Error adding sub-allocation:", err);
      toast.error(err.message || "Failed to add sub-allocation");
    } finally {
      setIsAdding(false);
    }
  };

  // Inline update amount
  const handleUpdateAmount = async (subId: string) => {
    const rawVal = editingAmounts[subId];
    const numVal = parseFloat(rawVal);
    if (isNaN(numVal) || numVal < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setUpdatingId(subId);
    try {
      const { error } = await supabase
        .from("investment_sub_allocations")
        .update({ amount: numVal })
        .eq("id", subId);

      if (error) throw error;
      toast.success("Amount updated");
      fetchData();
    } catch (err: any) {
      console.error("Error updating sub-allocation amount:", err);
      toast.error("Failed to update amount");
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete sub-allocation
  const handleDeleteSubAllocation = async (subId: string, name: string) => {
    try {
      const { error } = await supabase
        .from("investment_sub_allocations")
        .delete()
        .eq("id", subId);

      if (error) throw error;
      toast.success(`Removed sub-allocation for ${name}`);
      fetchData();
    } catch (err: any) {
      console.error("Error deleting sub-allocation:", err);
      toast.error("Failed to remove sub-allocation");
    }
  };

  // Copy from previous month
  const handleCopyFromPreviousMonth = async () => {
    const prevMonth = subMonths(selectedMonth, 1);
    const prevMonthStr = format(prevMonth, "yyyy-MM-01");

    setIsCopying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const householdId = scope === "family" && household ? household.id : null;

      // Query previous month's sub-allocations for this category
      let prevQuery = supabase
        .from("investment_sub_allocations")
        .select("*")
        .eq("month_year", prevMonthStr)
        .eq("category", selectedCategory);

      if (householdId) {
        prevQuery = prevQuery.eq("household_id", householdId);
      } else {
        prevQuery = prevQuery.is("household_id", null).eq("user_id", user.id);
      }

      const { data: prevSubs, error: prevError } = await prevQuery;
      if (prevError) throw prevError;

      if (!prevSubs || prevSubs.length === 0) {
        toast.info(`No sub-allocations found for ${format(prevMonth, "MMMM yyyy")} in ${selectedCategory}`);
        return;
      }

      // Filter out instruments that already exist in current month
      const existingInstIds = new Set(currentCategorySubs.map(s => s.instrument_id));
      const toInsert = prevSubs
        .filter(s => !existingInstIds.has(s.instrument_id))
        .map(s => ({
          user_id: user.id,
          household_id: householdId,
          month_year: monthStr,
          category: selectedCategory,
          instrument_id: s.instrument_id,
          amount: s.amount,
          notes: s.notes,
        }));

      if (toInsert.length === 0) {
        toast.info("All instruments from the previous month are already added for this month.");
        return;
      }

      const { error: insertError } = await supabase
        .from("investment_sub_allocations")
        .insert(toInsert);

      if (insertError) throw insertError;

      toast.success(`Copied ${toInsert.length} sub-allocation(s) from ${format(prevMonth, "MMM yyyy")}`);
      fetchData();
    } catch (err: any) {
      console.error("Error copying from previous month:", err);
      toast.error("Failed to copy from previous month");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Selection Tabs / Carousel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Select Investment Category</Label>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-primary gap-1"
            onClick={() => navigate("/goal-allocation")}
          >
            Manage Monthly Allocations in Goal Allocation <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {INVESTMENT_CATEGORIES.map(cat => {
            const allocated = categoryAllocations[cat] || 0;
            const subsForCat = subAllocations.filter(s => s.category === cat);
            const subTotal = subsForCat.reduce((sum, s) => sum + Number(s.amount || 0), 0);
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-xs truncate" title={cat}>
                    {cat}
                  </span>
                  {allocated > 0 && subTotal >= allocated ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  Allocated: <span className="font-medium text-foreground">₹{allocated.toLocaleString()}</span>
                </div>
                {subsForCat.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Sub-allocated: ₹{subTotal.toLocaleString()} ({subsForCat.length})
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Category Header & Allocation Status */}
      <Card className="border-primary/20 bg-gradient-to-r from-card to-primary/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal text-xs">
                  {format(selectedMonth, "MMMM yyyy")}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {scope === "family" ? "Family Household" : "Personal"}
                </Badge>
              </div>
              <h3 className="text-xl font-bold mt-1 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {selectedCategory}
              </h3>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
              <div className="bg-background/80 p-2.5 rounded-lg border shadow-sm">
                <div className="text-xs text-muted-foreground">Allocated</div>
                <div className="text-base sm:text-lg font-bold text-foreground">
                  ₹{totalAllocatedToCategory.toLocaleString()}
                </div>
              </div>
              <div className="bg-background/80 p-2.5 rounded-lg border shadow-sm">
                <div className="text-xs text-muted-foreground">Sub-Allocated</div>
                <div className="text-base sm:text-lg font-bold text-primary">
                  ₹{totalSubAllocated.toLocaleString()}
                </div>
              </div>
              <div className="bg-background/80 p-2.5 rounded-lg border shadow-sm">
                <div className="text-xs text-muted-foreground">Remaining</div>
                <div className={`text-base sm:text-lg font-bold ${
                  remainingToSubAllocate < 0
                    ? "text-red-600"
                    : remainingToSubAllocate === 0 && totalAllocatedToCategory > 0
                    ? "text-green-600"
                    : "text-amber-600"
                }`}>
                  {remainingToSubAllocate < 0 ? "-" : ""}₹{Math.abs(remainingToSubAllocate).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Progress Bar */}
          {totalAllocatedToCategory > 0 ? (
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Sub-allocation Progress: {pctSubAllocated}%
                </span>
                <span className="font-medium">
                  {remainingToSubAllocate === 0 ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Fully Sub-allocated
                    </span>
                  ) : remainingToSubAllocate < 0 ? (
                    <span className="text-red-600">
                      Over by ₹{Math.abs(remainingToSubAllocate).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      ₹{remainingToSubAllocate.toLocaleString()} left to assign
                    </span>
                  )}
                </span>
              </div>
              <Progress
                value={pctSubAllocated}
                className={`h-2 ${
                  remainingToSubAllocate < 0
                    ? "[&>div]:bg-red-500"
                    : remainingToSubAllocate === 0
                    ? "[&>div]:bg-green-500"
                    : "[&>div]:bg-primary"
                }`}
              />
            </div>
          ) : (
            <div className="bg-muted/40 p-3 rounded-md border border-dashed flex items-start gap-2.5 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span>
                  No monthly earnings have been allocated to <strong>{selectedCategory}</strong> yet for {format(selectedMonth, "MMMM yyyy")}.
                </span>
                <div className="mt-1">
                  You can plan your sub-allocations here now, or{" "}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-semibold underline"
                    onClick={() => navigate("/goal-allocation")}
                  >
                    go to Goal Allocation to allocate salary/income
                  </Button>.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            Sub-Allocate to Instrument
          </Button>

          <Button
            variant="outline"
            onClick={handleCopyFromPreviousMonth}
            disabled={isCopying || loading}
            className="gap-1.5"
            title="Copy sub-allocations from previous month"
          >
            <Copy className="h-4 w-4" />
            {isCopying ? "Copying..." : "Copy from Last Month"}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateToMaster(selectedCategory)}
          className="text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          Manage Defined {selectedCategory} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Sub-allocations Items List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Sub-Allocated Instruments ({currentCategorySubs.length})</span>
            {totalAllocatedToCategory > 0 && currentCategorySubs.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                Total: ₹{totalSubAllocated.toLocaleString()} of ₹{totalAllocatedToCategory.toLocaleString()}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Specific funds and stocks receiving funds this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading allocations...</div>
          ) : currentCategorySubs.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <PieChart className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h4 className="font-semibold text-sm">No sub-allocations yet for {selectedCategory}</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Distribute your allocated {selectedCategory} budget across specific mutual funds or stocks.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add First Instrument
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyFromPreviousMonth} className="gap-1.5">
                  <Copy className="h-4 w-4" /> Copy from Last Month
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {currentCategorySubs.map((sub) => {
                const instName = sub.instrument?.name || "Unknown Instrument";
                const instTicker = sub.instrument?.code_or_ticker;
                const instNotes = sub.instrument?.notes || sub.notes;
                const subPct = totalAllocatedToCategory > 0
                  ? Math.round((Number(sub.amount) / totalAllocatedToCategory) * 100)
                  : 0;

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 border rounded-lg bg-card/60 hover:bg-card transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{instName}</span>
                        {instTicker && (
                          <Badge variant="secondary" className="text-[11px] font-mono">
                            {instTicker}
                          </Badge>
                        )}
                        {totalAllocatedToCategory > 0 && (
                          <Badge variant="outline" className="text-[11px]">
                            {subPct}% of total
                          </Badge>
                        )}
                      </div>
                      {instNotes && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {instNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          className="h-8 pl-6 text-right font-medium text-sm"
                          value={editingAmounts[sub.id] ?? sub.amount}
                          onChange={(e) => {
                            setEditingAmounts(prev => ({ ...prev, [sub.id]: e.target.value }));
                          }}
                          onBlur={() => {
                            if (editingAmounts[sub.id] !== sub.amount.toString()) {
                              handleUpdateAmount(sub.id);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateAmount(sub.id);
                            }
                          }}
                          disabled={updatingId === sub.id}
                        />
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSubAllocation(sub.id, instName)}
                        title="Remove Sub-allocation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Sub-allocation Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sub-Allocate to {selectedCategory}</DialogTitle>
            <DialogDescription>
              Select an instrument from your defined {selectedCategory} portfolio and enter the planned investment amount for {format(selectedMonth, "MMMM yyyy")}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sub-inst">Select Instrument *</Label>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    onNavigateToMaster(selectedCategory);
                  }}
                >
                  + Define New Fund/Stock
                </Button>
              </div>

              {availableInstrumentsForCategory.length === 0 ? (
                <div className="p-3 bg-muted/50 rounded-md border text-xs text-muted-foreground space-y-2">
                  <p>
                    No unused active instruments available under <strong>{selectedCategory}</strong>.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      onNavigateToMaster(selectedCategory);
                    }}
                  >
                    + Define a New {selectedCategory} Now
                  </Button>
                </div>
              ) : (
                <Select value={selectedInstrumentId} onValueChange={setSelectedInstrumentId}>
                  <SelectTrigger id="sub-inst">
                    <SelectValue placeholder="Choose fund or stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInstrumentsForCategory.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name} {inst.code_or_ticker ? `(${inst.code_or_ticker})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sub-amount">Sub-Allocation Amount (₹) *</Label>
                {remainingToSubAllocate > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => setAddAmount(remainingToSubAllocate.toString())}
                  >
                    Use remaining (₹{remainingToSubAllocate.toLocaleString()})
                  </Button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                <Input
                  id="sub-amount"
                  type="number"
                  placeholder="0.00"
                  className="pl-8"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-notes">Monthly Note / Execution Date (Optional)</Label>
              <Input
                id="sub-notes"
                placeholder="e.g. SIP triggered on 5th Oct"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSubAllocation}
              disabled={isAdding || availableInstrumentsForCategory.length === 0}
            >
              {isAdding ? "Saving..." : "Add Sub-Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
