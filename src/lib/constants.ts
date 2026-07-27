
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
    "Fruits",
    "Fuel",
    "School Fees",
    "Travel",
    "Mobile Bill",
    "Boardband Bill",
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
    "NPS",
    "EPF",
    "PPF",
    "Sukanya Samriddhi Yojana (SSY)",
    "Post Office Schemes (POS)",
    "Annuity Plans",
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

// Controllability classification for expense categories
// Used in Reports page for insight cards and category breakdown badges
export type ControllabilityType = "discretionary" | "semi-fixed" | "fixed";

export const CONTROLLABLE_CATEGORIES: Record<string, ControllabilityType> = {
    "Groceries": "semi-fixed",
    "Vegetables": "semi-fixed",
    "Fruits": "semi-fixed",
    "Fuel": "semi-fixed",
    "School Fees": "fixed",
    "Travel": "discretionary",
    "Mobile Bill": "fixed",
    "Boardband Bill": "fixed",
    "Utilities": "fixed",
    "Healthcare": "semi-fixed",
    "Entertainment": "discretionary",
    "Dinning": "discretionary",
    "Coffee/Snacks": "discretionary",
    "EMI/Loans": "fixed",
    "Credit Card Bill": "fixed",
    "Insurance": "fixed",
    "Other": "discretionary",
};
