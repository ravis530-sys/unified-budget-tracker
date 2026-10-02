import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/useHousehold";
import { INVESTMENT_CATEGORIES } from "@/lib/constants";
import { Plus, Search, Pencil, Trash2, Check, X, Briefcase, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export interface InvestmentInstrument {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  category: string;
  code_or_ticker: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InvestmentInstrumentsManagerProps {
  scope: "individual" | "family";
  defaultCategory?: string;
  onInstrumentsChanged?: () => void;
}

export const InvestmentInstrumentsManager = ({
  scope,
  defaultCategory,
  onInstrumentsChanged,
}: InvestmentInstrumentsManagerProps) => {
  const { household } = useHousehold();
  const [instruments, setInstruments] = useState<InvestmentInstrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(defaultCategory || "all");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<InvestmentInstrument | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState(defaultCategory || INVESTMENT_CATEGORIES[0]);
  const [formCode, setFormCode] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInstruments();
  }, [scope, household]);

  useEffect(() => {
    if (defaultCategory && defaultCategory !== "all") {
      setCategoryFilter(defaultCategory);
    }
  }, [defaultCategory]);

  const fetchInstruments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("investment_instruments")
        .select("*")
        .order("name", { ascending: true });

      if (scope === "family" && household) {
        query = query.eq("household_id", household.id);
      } else {
        query = query.is("household_id", null).eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInstruments((data as InvestmentInstrument[]) || []);
    } catch (err: any) {
      console.error("Error fetching investment instruments:", err);
      toast.error("Failed to load investment instruments");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingInstrument(null);
    setFormName("");
    setFormCategory(categoryFilter !== "all" ? categoryFilter : INVESTMENT_CATEGORIES[0]);
    setFormCode("");
    setFormNotes("");
    setFormActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (inst: InvestmentInstrument) => {
    setEditingInstrument(inst);
    setFormName(inst.name);
    setFormCategory(inst.category);
    setFormCode(inst.code_or_ticker || "");
    setFormNotes(inst.notes || "");
    setFormActive(inst.is_active);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Please enter instrument name");
      return;
    }
    if (!formCategory) {
      toast.error("Please select a category");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const householdId = scope === "family" && household ? household.id : null;

      if (editingInstrument) {
        const { error } = await supabase
          .from("investment_instruments")
          .update({
            name: formName.trim(),
            category: formCategory,
            code_or_ticker: formCode.trim() || null,
            notes: formNotes.trim() || null,
            is_active: formActive,
          })
          .eq("id", editingInstrument.id);

        if (error) throw error;
        toast.success("Instrument updated successfully");
      } else {
        const { error } = await supabase
          .from("investment_instruments")
          .insert({
            user_id: user.id,
            household_id: householdId,
            name: formName.trim(),
            category: formCategory,
            code_or_ticker: formCode.trim() || null,
            notes: formNotes.trim() || null,
            is_active: formActive,
          });

        if (error) throw error;
        toast.success("Instrument added to master list");
      }

      setIsDialogOpen(false);
      fetchInstruments();
      onInstrumentsChanged?.();
    } catch (err: any) {
      console.error("Error saving instrument:", err);
      toast.error(err.message || "Failed to save instrument");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (inst: InvestmentInstrument) => {
    try {
      const { error } = await supabase
        .from("investment_instruments")
        .update({ is_active: !inst.is_active })
        .eq("id", inst.id);

      if (error) throw error;
      setInstruments(prev =>
        prev.map(item => item.id === inst.id ? { ...item, is_active: !item.is_active } : item)
      );
      toast.success(`${inst.name} is now ${!inst.is_active ? "active" : "inactive"}`);
      onInstrumentsChanged?.();
    } catch (err: any) {
      console.error("Error toggling active state:", err);
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Any monthly sub-allocations linked to this instrument will also be removed.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("investment_instruments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Instrument deleted");
      fetchInstruments();
      onInstrumentsChanged?.();
    } catch (err: any) {
      console.error("Error deleting instrument:", err);
      toast.error("Failed to delete instrument");
    }
  };

  const filteredInstruments = instruments.filter(inst => {
    const matchesCategory = categoryFilter === "all" || inst.category === categoryFilter;
    const matchesSearch =
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inst.code_or_ticker && inst.code_or_ticker.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inst.notes && inst.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Controls & Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Defined Investment Instruments
              </CardTitle>
              <CardDescription>
                Define your portfolio wishlist (Mutual Funds, Stocks, ETFs, etc.) where you regularly invest
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" />
              Add Instrument
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search funds, stocks, tickers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full md:w-64">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories ({instruments.length})</SelectItem>
                  {INVESTMENT_CATEGORIES.map(cat => {
                    const count = instruments.filter(i => i.category === cat).length;
                    return (
                      <SelectItem key={cat} value={cat}>
                        {cat} {count > 0 ? `(${count})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instruments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading instruments...</div>
        ) : filteredInstruments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h3 className="font-semibold text-base mb-1">No instruments found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {searchQuery || categoryFilter !== "all"
                  ? "Try changing your search query or category filter."
                  : "You haven't defined any mutual funds, stocks, or other instruments yet. Add your first one to get started!"}
              </p>
              <Button onClick={openAddDialog} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Instrument Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInstruments.map((inst) => (
              <Card
                key={inst.id}
                className={`transition-all hover:shadow-md ${!inst.is_active ? "opacity-60 bg-muted/40" : ""}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs font-normal">
                          {inst.category}
                        </Badge>
                        {inst.code_or_ticker && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            {inst.code_or_ticker}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-base leading-snug line-clamp-2">
                        {inst.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(inst)}
                        title="Edit Instrument"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(inst.id, inst.name)}
                        title="Delete Instrument"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {inst.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded border border-muted/50">
                      {inst.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-muted-foreground">
                      Status: {inst.is_active ? (
                        <span className="text-green-600 font-medium">Active</span>
                      ) : (
                        <span className="text-muted-foreground">Inactive</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${inst.id}`} className="text-xs cursor-pointer text-muted-foreground">
                        {inst.is_active ? "Active" : "Paused"}
                      </Label>
                      <Switch
                        id={`active-${inst.id}`}
                        checked={inst.is_active}
                        onCheckedChange={() => handleToggleActive(inst)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingInstrument ? "Edit Investment Instrument" : "Add Investment Instrument"}
            </DialogTitle>
            <DialogDescription>
              Define a specific Mutual Fund, Stock, ETF or other instrument for your investment wishlist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inst-name">Instrument / Fund Name *</Label>
              <Input
                id="inst-name"
                placeholder="e.g. Parag Parikh Flexi Cap Fund Direct Growth"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inst-category">Category *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger id="inst-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inst-code">Symbol / Ticker / Folio (Optional)</Label>
              <Input
                id="inst-code"
                placeholder="e.g. PPFAS, RELIANCE, NIFTYBEES"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inst-notes">Notes / SIP Instructions (Optional)</Label>
              <Input
                id="inst-notes"
                placeholder="e.g. SIP on 5th of each month, Zerodha Coin"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label htmlFor="inst-active">Active for Sub-Allocation</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive instruments won't appear as primary choices when allocating
                </p>
              </div>
              <Switch
                id="inst-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingInstrument ? "Update" : "Save Instrument"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
