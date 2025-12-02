import { useState, useEffect } from "react";
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const INTERVALS = [
  { value: "one-time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
];

interface EditBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  budget: {
    id: string;
    category: string;
    planned_amount: number;
    type: string;
    interval: string;
    start_date: string;
  } | null;
}

const EditBudgetDialog = ({ open, onOpenChange, onSuccess, budget }: EditBudgetDialogProps) => {
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState("monthly");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (budget) {
      setAmount(budget.planned_amount.toString());
      setInterval(budget.interval || "monthly");
      setStartDate(budget.start_date ? new Date(budget.start_date) : new Date());
    }
  }, [budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("monthly_budgets")
        .update({
          planned_amount: parseFloat(amount),
          interval,
          start_date: startDate.toISOString().split('T')[0],
        })
        .eq("id", budget.id);

      if (error) throw error;

      toast.success("Budget updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update budget");
    } finally {
      setLoading(false);
    }
  };

  if (!budget) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="p-2 bg-muted rounded-md text-sm capitalize">
              {budget.type}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              {budget.category}
            </div>
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
            <Label>Expected Date</Label>
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



          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditBudgetDialog;
