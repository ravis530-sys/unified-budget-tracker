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
import { CreditCard, Smartphone, RotateCcw, Coins } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, INTERVALS, INVESTMENT_CATEGORIES, CATEGORY_SUB_ITEMS } from "@/lib/constants";


interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  transaction_date: string;
  interval: string;
  remarks: string | null;
  name?: string | null;
  payment_method?: string | null;
  tag?: string | null;
}

interface PaidBackExpense {
  id: string;
  category: string;
  amount: number;
  transaction_date: string;
  remarks: string | null;
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
  const [subCategory, setSubCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "creditcard" | "cash">("upi");
  const [loading, setLoading] = useState(false);
  const [budgetCategories, setBudgetCategories] = useState<string[]>([]);
  const [budgetRemaining, setBudgetRemaining] = useState<Record<string, number>>({});
  const [isPaidBack, setIsPaidBack] = useState(false);
  const [paidBackAgainstId, setPaidBackAgainstId] = useState("");
  const [paidBackExpenses, setPaidBackExpenses] = useState<PaidBackExpense[]>([]);

  // Fetch budget categories when type changes to expense
  useEffect(() => {
    if (type === "expense" && open) {
      fetchBudgetCategories();
    }
  }, [type, open, date]);

  // Fetch unlinked paid-back expenses when income tab is active
  useEffect(() => {
    if (type === "income" && open) {
      fetchPaidBackExpenses();
    }
  }, [type, open, scope]);

  const fetchPaidBackExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let householdId: string | null = null;
      if (scope === "family") {
        const { data: membership } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .single();
        householdId = membership?.household_id || null;
      }

      // Fetch expenses tagged as "paid_back"
      let expQuery = supabase
        .from("transactions")
        .select("id, category, amount, transaction_date, remarks")
        .eq("type", "expense")
        .eq("tag", "paid_back");

      if (scope === "individual") {
        expQuery = expQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        expQuery = expQuery.eq("household_id", householdId);
      }

      const { data: taggedExpenses } = await expQuery;

      if (!taggedExpenses || taggedExpenses.length === 0) {
        setPaidBackExpenses([]);
        return;
      }

      // Fetch income transactions that are already linked to paid-back expenses
      let incQuery = supabase
        .from("transactions")
        .select("tag")
        .eq("type", "income")
        .like("tag", "paid_back:%");

      if (scope === "individual") {
        incQuery = incQuery.eq("user_id", user.id).is("household_id", null);
      } else {
        incQuery = incQuery.eq("household_id", householdId);
      }

      const { data: linkedIncomes } = await incQuery;

      // Extract already-linked expense IDs
      const linkedExpenseIds = new Set(
        (linkedIncomes || []).map(inc => inc.tag?.replace("paid_back:", "")).filter(Boolean)
      );

      // Filter out already-linked expenses (but keep the one currently being edited)
      const unlinked = taggedExpenses.filter(exp => {
        if (linkedExpenseIds.has(exp.id)) {
          // If we're editing and this income is linked to this expense, still show it
          if (transaction && transaction.tag === `paid_back:${exp.id}`) return true;
          return false;
        }
        return true;
      });

      setPaidBackExpenses(unlinked as PaidBackExpense[]);
    } catch (error) {
      console.error("Error fetching paid-back expenses:", error);
    }
  };

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

  // Update form when transaction changes or dialog opens
  useEffect(() => {
    if (open && transaction) {
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
      // If this category has sub-items, populate subCategory from name field
      if (CATEGORY_SUB_ITEMS[transaction.category]) {
        setSubCategory(transaction.name || "");
        setName("");
      } else {
        setSubCategory("");
        setName(transaction.name || "");
      }
      setPaymentMethod((transaction.payment_method as "upi" | "creditcard" | "cash") || "upi");
      // Restore tag state
      if (transaction.tag === "paid_back") {
        setIsPaidBack(true);
        setPaidBackAgainstId("");
      } else if (transaction.tag?.startsWith("paid_back:")) {
        setIsPaidBack(false);
        setPaidBackAgainstId(transaction.tag.replace("paid_back:", ""));
      } else {
        setIsPaidBack(false);
        setPaidBackAgainstId("");
      }
    } else if (!open) {
      // Reset form when dialog closes
      setType("income");
      setActiveTab("income");
      setCategory("");
      setSubCategory("");
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setInterval("one-time");
      setRemarks("");
      setName("");
      setPaymentMethod("upi");
      setIsPaidBack(false);
      setPaidBackAgainstId("");
    }
  }, [transaction, open]);

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

      // Resolve the name field: use subCategory for categories with sub-items, else name
      const resolvedName = CATEGORY_SUB_ITEMS[category] ? subCategory || null : name || null;

      // Resolve tag value
      let resolvedTag: string | null = null;
      if (type === "expense" && isPaidBack) {
        resolvedTag = "paid_back";
      } else if (type === "income" && paidBackAgainstId && paidBackAgainstId !== "none") {
        resolvedTag = `paid_back:${paidBackAgainstId}`;
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
            name: resolvedName,
            payment_method: type === "expense" ? paymentMethod : null,
            tag: resolvedTag,
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
          name: resolvedName,
          payment_method: type === "expense" ? paymentMethod : null,
          tag: resolvedTag,
        });

        if (error) throw error;
        toast.success("Transaction added successfully");
      }

      // Reset form
      setCategory("");
      setSubCategory("");
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setInterval("one-time");
      setRemarks("");
      setName("");
      setPaymentMethod("upi");
      setIsPaidBack(false);
      setPaidBackAgainstId("");

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
          setSubCategory("");
          setIsPaidBack(false);
          setPaidBackAgainstId("");
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
                <Select
                  key={`${category}-${budgetCategories.length}`}
                  value={category}
                  onValueChange={(val) => {
                    setCategory(val);
                    // Set default sub-category (last item = "Bike") when switching to a sub-item category
                    if (CATEGORY_SUB_ITEMS[val]) {
                      setSubCategory(CATEGORY_SUB_ITEMS[val][CATEGORY_SUB_ITEMS[val].length - 1]);
                    } else {
                      setSubCategory("");
                    }
                  }}
                >
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

              {/* Sub-category radio selector for categories like Fuel */}
              {type === "expense" && category && CATEGORY_SUB_ITEMS[category] && (
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <div className="flex gap-4">
                    {CATEGORY_SUB_ITEMS[category].map((item) => (
                      <label
                        key={item}
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <input
                          type="radio"
                          name="vehicleType"
                          value={item}
                          checked={subCategory === item}
                          onChange={() => setSubCategory(item)}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="text-sm font-medium">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Name field only for income */}
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

              {/* Paid Back tag for expenses */}
              {type === "expense" && (
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="paid-back"
                    checked={isPaidBack}
                    onCheckedChange={(checked) => setIsPaidBack(checked === true)}
                  />
                  <Label htmlFor="paid-back" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                    Mark as Paid Back
                  </Label>
                  <span className="text-xs text-muted-foreground ml-auto">Will be reimbursed later</span>
                </div>
              )}

              {/* Paid back against dropdown for income */}
              {type === "income" && paidBackExpenses.length > 0 && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                    Paid Back Against Expense (Optional)
                  </Label>
                  <Select value={paidBackAgainstId} onValueChange={setPaidBackAgainstId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select expense to reimburse..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {paidBackExpenses.map((exp) => (
                        <SelectItem key={exp.id} value={exp.id}>
                          <div className="flex items-center gap-2">
                            <span>{exp.category}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">₹{Number(exp.amount).toLocaleString()}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(exp.transaction_date), "MMM d, yyyy")}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {type === "expense" && (
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-3 gap-2 bg-muted p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("upi")}
                      className={`flex items-center justify-center gap-2 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                        paymentMethod === "upi"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Smartphone className="h-4 w-4 text-primary" />
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("creditcard")}
                      className={`flex items-center justify-center gap-2 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                        paymentMethod === "creditcard"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <CreditCard className="h-4 w-4 text-orange-500" />
                      Credit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex items-center justify-center gap-2 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                        paymentMethod === "cash"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Coins className="h-4 w-4 text-green-600" />
                      Cash
                    </button>
                  </div>
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
