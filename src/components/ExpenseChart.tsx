import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CATEGORY_SUB_ITEMS } from "@/lib/constants";

interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  subItems?: { name: string; value: number }[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CategoryData;
    const color = payload[0].payload.fill || "hsl(var(--primary))";

    return (
      <div className="bg-white border border-[#ccc] p-2.5 shadow-sm text-sm font-sans">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-medium">{data.name}:</span>
          <span>{formatCurrency(data.value)}</span>
        </div>
        {data.subItems && data.subItems.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-[#eee] space-y-1">
            {data.subItems.map((sub) => (
              <div key={sub.name} className="flex justify-between gap-6 text-xs text-muted-foreground ml-4">
                <span>{sub.name}</span>
                <span>{formatCurrency(sub.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

interface ExpenseChartProps {
  scope: "individual" | "family";
  selectedMonth?: Date;
  onDataLoaded?: (hasData: boolean) => void;
}

const ExpenseChart = ({ scope, selectedMonth = new Date(), onDataLoaded }: ExpenseChartProps) => {
  const [data, setData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenseData();
  }, [scope, selectedMonth]);

  const fetchExpenseData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      let householdId: string | null = null;
      if (scope === "family") {
        const { data: membership } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .single();
        householdId = membership?.household_id || null;
      }

      let query = supabase
        .from("transactions")
        .select("*")
        .eq("type", "expense")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      if (scope === "individual") {
        query = query.eq("user_id", user.id).is("household_id", null);
      } else {
        query = query.eq("household_id", householdId);
      }

      const { data: expenses } = await query;
      const rows = (expenses || []) as any[];

      if (rows.length === 0) {
        setLoading(false);
        if (onDataLoaded) onDataLoaded(false);
        return;
      }

      // Group by category and collect sub-items
      const categoryMap: Record<string, CategoryData> = {};

      rows.forEach((expense) => {
        const catName = expense.category;
        const amount = Number(expense.amount);
        const subName = expense.name?.trim();
        const hasSubItems = !!CATEGORY_SUB_ITEMS[catName];

        if (!categoryMap[catName]) {
          categoryMap[catName] = {
            name: catName,
            value: 0,
            percentage: 0,
            subItems: hasSubItems ? [] : undefined
          };
        }

        categoryMap[catName].value += amount;

        if (hasSubItems && subName && categoryMap[catName].subItems) {
          const existingSub = categoryMap[catName].subItems!.find(s => s.name === subName);
          if (existingSub) {
            existingSub.value += amount;
          } else {
            categoryMap[catName].subItems!.push({ name: subName, value: amount });
          }
        }
      });

      const total = Object.values(categoryMap).reduce((sum, d) => sum + d.value, 0);

      const chartData: CategoryData[] = Object.values(categoryMap).map((d) => ({
        ...d,
        percentage: total > 0 ? (d.value / total) * 100 : 0,
      }));

      setData(chartData);
      if (onDataLoaded) onDataLoaded(chartData.length > 0);
    } catch (error) {
      console.error("Error fetching expense data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="h-32 w-32 bg-muted animate-pulse rounded-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No expense data for this month
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.percentage.toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default ExpenseChart;
