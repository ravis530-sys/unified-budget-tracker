import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, INTERVALS, INVESTMENT_CATEGORIES } from "@/lib/constants";


interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  transaction_date: string;
  interval: string;
  remarks: string | null;
  name?: string | null;
}

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  transaction?: Transaction | null;
  scope: "individual" | "family";
}

const AddTransactionDialog = ({ open, onOpenChange, onSuccess, transaction, scope }: AddTransactionDialogProps) => {
  const [type, setType] = useState<"income" | "expense" | "investment">(transaction?.type as "income" | "expense" | "investment" || "income");
  const [activeTab, setActiveTab] = useState<"income" | "expense" | "investment">("income");
  const [category, setCategory] = useState(transaction?.category || "");
  const [amount, setAmount] = useState(transaction?.amount.toString() || "");
  const [date, setDate] = useState(transaction?.transaction_date || format(new Date(), "yyyy-MM-dd"));
  const [interval, setInterval] = useState(transaction?.interval || "one-time");
  const [remarks, setRemarks] = useState(transaction?.remarks || "");
  const [name, setName] = useState(transaction?.name || "");
  const [loading, setLoading] = useState(false);
  const [budgetCategories, setBudgetCategories] = useState<string[]>([]);
  const [budgetRemaining, setBudgetRemaining] = useState<Record<string, number>>({});

  // Fetch budget categories when type changes to expense
  useEffect(() => {
    if (type === "expense" && open) {
      fetchBudgetCategories();
    }
  }, [type, open, date]);

  const fetchBudgetCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const transactionDate = new Date(date);
      const monthStart = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
      const monthEnd = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0);

      // Fetch budgets for the transaction's month
      const { data: budgets } = await supabase
        .from("monthly_budgets")
        .select("category, planned_amount")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("month_year", monthStart.toISOString().split('T')[0]);

      // Fetch actual expenses for each category
      const { data: transactions } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("transaction_date", monthStart.toISOString())
        .lte("transaction_date", monthEnd.toISOString());

      if (budgets) {
        const categories = budgets.map(b => b.category);
        setBudgetCategories(categories);

        // Calculate remaining budget for each category
        const remaining: Record<string, number> = {};
        budgets.forEach(budget => {
          const spent = transactions
            ?.filter(t => t.category === budget.category)
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          remaining[budget.category] = Number(budget.planned_amount) - spent;
        });
        setBudgetRemaining(remaining);
      }
    } catch (error) {
      console.error("Error fetching budget categories:", error);
    }
  };

  // Update form when transaction changes
  useEffect(() => {
    if (transaction) {
      const txType = transaction.type as "income" | "expense" | "investment";
      setType(txType);

      if (txType === "investment") {
        setActiveTab("investment");
      } else {
        setActiveTab(txType);
      }

      setCategory(transaction.category);
      setAmount(transaction.amount.toString());
      setDate(transaction.transaction_date);
      setInterval(transaction.interval);
      setRemarks(transaction.remarks || "");
      setName(transaction.name || "");
    } else {
      // Reset form when transaction is null (add mode)
      setType("income");
      setActiveTab("income");
      setCategory("");
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setInterval("one-time");
      setRemarks("");
      setName("");
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error("Please select a category");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get household_id for family scope
      let householdId: string | null = null;
      if (scope === "family") {
        const { data: membership } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .single();
        householdId = membership?.household_id || null;
      }

      if (transaction) {
        // Update existing transaction
        const { error } = await supabase
          .from("transactions")
          .update({
            type,
            category,
            amount: Number(amount),
            transaction_date: date,
            interval,
            remarks: remarks || null,
            name: name || null,
          })
          .eq("id", transaction.id);

        if (error) throw error;
        toast.success("Transaction updated successfully");
      } else {
        // Insert new transaction
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          household_id: householdId,
          type,
          category,
          amount: Number(amount),
          transaction_date: date,
          interval,
          remarks: remarks || null,
          name: name || null,
        });

        if (error) throw error;
        toast.success("Transaction added successfully");
      }

      // Reset form
      setCategory("");
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setInterval("one-time");
      setRemarks("");
      setName("");

      onSuccess();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${transaction ? 'update' : 'add'} transaction`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit' : 'Add'} Transaction</DialogTitle>
          <DialogDescription>
            {transaction ? 'Update' : 'Record a new'} income or expense transaction
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => {
          const newTab = v as "income" | "expense" | "investment";
          setActiveTab(newTab);
          if (newTab === "income") setType("income");
          else if (newTab === "expense") setType("expense");
          else setType("investment");
          setCategory("");
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="investment">Investment</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTab === "investment" ? (
                      INVESTMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))
                    ) : type === "expense" && budgetCategories.length > 0 ? (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Budget Categories</div>
                        {budgetCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{cat}</span>
                              <span className={`text-xs ${budgetRemaining[cat] < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                ₹{budgetRemaining[cat]?.toLocaleString() || 0} left
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t">Other Categories</div>
                        {EXPENSE_CATEGORIES.filter(cat => !budgetCategories.includes(cat)).map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {type === "income" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name (Optional)</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Bonus, Freelance Project"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (INR)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interval">Interval</Label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger id="interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((int) => (
                      <SelectItem key={int.value} value={int.value}>
                        {int.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  placeholder="Add any additional notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (transaction ? "Updating..." : "Adding...") : (transaction ? "Update Transaction" : "Add Transaction")}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddTransactionDialog;
