import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfMonth, format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

interface AddBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  selectedMonth: Date;
  scope: "individual" | "family";
}

const INCOME_CATEGORIES = [
  "Salary",
  "Rental Income",
  "Fixed Deposits (FD)",
  "Mutual Funds (MF)",
  "Dividends",
  "Bonds",
  "Other",
];

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Vegetables",
  "School Fees",
  "Travel",
  "Mobile Bill",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "EMI/Loans",
  "Insurance",
  "Other",
];

const INTERVALS = [
  { value: "one-time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
];

const AddBudgetDialog = ({ open, onOpenChange, onSuccess, selectedMonth, scope }: AddBudgetDialogProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState("monthly");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const monthStart = startOfMonth(selectedMonth);

      // Calculate how many entries to create based on interval
      // For now, we'll project out 1 year (12 months)
      const entries = [];
      let currentMonth = monthStart;
      let monthsToAdd = 0;

      switch (interval) {
        case "monthly":
          monthsToAdd = 1;
          break;
        case "quarterly":
          monthsToAdd = 3;
          break;
        case "half-yearly":
          monthsToAdd = 6;
          break;
        case "yearly":
          monthsToAdd = 12;
          break;
        default: // one-time
          monthsToAdd = 0;
      }

      if (monthsToAdd === 0) {
        // One-time budget
        entries.push({
          user_id: user.id,
          household_id: householdId,
          month_year: monthStart.toISOString().split('T')[0],
          category,
          planned_amount: parseFloat(amount),
          type,
          interval: "one-time", // Store as one-time so they are independent
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate ? endDate.toISOString().split('T')[0] : null,
        });
      } else {
        // Generate entries for the next 12 months
        // We stop if we exceed the end date (if provided)
        for (let i = 0; i < 12; i += monthsToAdd) {
          const entryDate = addMonths(monthStart, i);

          if (endDate && entryDate > endDate) break;

          entries.push({
            user_id: user.id,
            household_id: householdId,
            month_year: entryDate.toISOString().split('T')[0],
            category,
            planned_amount: parseFloat(amount),
            type,
            interval: "one-time", // Store as one-time so they are independent
            start_date: entryDate.toISOString().split('T')[0],
            end_date: endDate ? endDate.toISOString().split('T')[0] : null,
          });
        }
      }

      const { error } = await supabase.from("monthly_budgets").upsert(entries);

      if (error) throw error;

      toast.success("Budget saved");
      setCategory("");
      setAmount("");
      setInterval("monthly");
      setInterval("monthly");
      setStartDate(new Date());
      setEndDate(undefined);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to save budget");
    } finally {
      setLoading(false);
    }
  };

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value: "income" | "expense") => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Planned Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Interval</Label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger>
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
            <Label>Expected Date (Pay/Bill Date)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>



          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddBudgetDialog;
