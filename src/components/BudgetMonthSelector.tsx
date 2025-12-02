import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";

interface BudgetMonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

const BudgetMonthSelector = ({ selectedMonth, onMonthChange }: BudgetMonthSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onMonthChange(subMonths(selectedMonth, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[200px] text-center">
        <h2 className="text-xl font-semibold">{format(selectedMonth, "MMMM yyyy")}</h2>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onMonthChange(addMonths(selectedMonth, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default BudgetMonthSelector;
