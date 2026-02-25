
export const INCOME_CATEGORIES = [
    "Salary",
    "Rental Income",
    "Fixed Deposits (FD)",
    "Mutual Funds (MF)",
    "Dividends",
    "Bonds",
    "Other",
];

export const EXPENSE_CATEGORIES = [
    "Groceries",
    "Vegetables",
    "Fuel",
    "School Fees",
    "Travel",
    "Mobile Bill",
    "Utilities",
    "Healthcare",
    "Entertainment",
    "Dinning",
    "Coffee/Snacks",
    "EMI/Loans",
    "Credit Card Bill",
    "Insurance",
    "Other",
];

export const INVESTMENT_CATEGORIES = [
    "Stocks",
    "ETFs",
    "Mutual Funds (MF)",
    "Fixed Deposits (FD)",
    "Bonds",
    "Lend",
    "Other Investments",
];

export const FUEL_VEHICLE_TYPES = ["Car", "Bike"];

// Map of expense categories that require a sub-item selection
export const CATEGORY_SUB_ITEMS: Record<string, string[]> = {
    "Fuel": FUEL_VEHICLE_TYPES,
};


export const INTERVALS = [
    { value: "one-time", label: "One-time" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "half-yearly", label: "Half Yearly" },
    { value: "yearly", label: "Yearly" },
];
