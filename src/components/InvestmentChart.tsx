import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface CategoryData {
    name: string;
    value: number;
    percentage: number;
}

const COLORS = [
    "hsl(217, 91%, 60%)", // Blue
    "hsl(212, 95%, 68%)", // Light Blue
    "hsl(199, 89%, 48%)", // Cyan
    "hsl(187, 71%, 42%)", // Teal
    "hsl(173, 58%, 39%)", // Dark Teal
];

interface InvestmentChartProps {
    scope: "individual" | "family";
    selectedMonth?: Date;
}

const InvestmentChart = ({ scope, selectedMonth = new Date() }: InvestmentChartProps) => {
    const [data, setData] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvestmentData();
    }, [scope, selectedMonth]);

    const fetchInvestmentData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
            const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

            // Get household context for family scope
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
                .select("category, amount")
                .eq("type", "investment")
                .gte("transaction_date", startDate)
                .lte("transaction_date", endDate);

            if (scope === "individual") {
                query = query.eq("user_id", user.id).is("household_id", null);
            } else {
                query = query.eq("household_id", householdId);
            }

            const { data: investments } = await query;

            if (!investments || investments.length === 0) {
                setData([]); // Clear data when no investments
                setLoading(false);
                return;
            }

            // Group by category and calculate totals
            const categoryTotals = investments.reduce((acc, investment) => {
                const category = investment.category;
                if (!acc[category]) {
                    acc[category] = 0;
                }
                acc[category] += Number(investment.amount);
                return acc;
            }, {} as Record<string, number>);

            const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

            // Convert to chart data with percentages
            const chartData: CategoryData[] = Object.entries(categoryTotals).map(([name, value]) => ({
                name,
                value,
                percentage: (value / total) * 100,
            }));

            setData(chartData);
        } catch (error) {
            console.error("Error fetching investment data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <div className="h-48 w-full bg-muted animate-pulse rounded" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
                No investment data for this month
            </div>
        );
    }

    const CustomLabel = (props: any) => {
        const { x, y, width, height, value } = props;
        const dataItem = data.find(d => d.value === value);
        const percentage = dataItem?.percentage.toFixed(1) || '0';

        return (
            <text
                x={x + width / 2}
                y={y + height / 2}
                fill="white"
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="bold"
                fontSize="14"
            >
                {percentage}%
            </text>
        );
    };

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="name"
                    hide
                />
                <YAxis
                    label={{ value: 'Amount (₹)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                        new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 4,
                        }).format(value),
                        props.payload.name
                    ]}
                />
                <Legend
                    payload={data.map((entry, index) => ({
                        value: entry.name,
                        type: 'square',
                        color: COLORS[index % COLORS.length]
                    }))}
                />
                <Bar dataKey="value" label={<CustomLabel />}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

export default InvestmentChart;
