export type CategorySpend = {
  category_id: number | null;
  category_name: string;
  category_icon: string | null;
  amount: string;
  expense_count: number;
};

export type SpendingSummary = {
  month: number;
  year: number;
  currency: string;
  total_spent: string;
  expense_count: number;
  by_category: CategorySpend[];
};

export type TrendPoint = {
  month: number;
  year: number;
  total_spent: string;
  expense_count: number;
};

export type SpendingTrend = {
  currency: string;
  months: TrendPoint[];
};

export type BudgetStatusItem = {
  budget_id: number;
  category_id: number | null;
  category_name: string;
  category_icon: string | null;
  budget_amount: string;
  actual_amount: string;
  remaining_amount: string;
  percent_used: string | null;
  is_over_budget: boolean;
};

export type BudgetStatusResponse = {
  month: number;
  year: number;
  currency: string;
  overall: BudgetStatusItem | null;
  categories: BudgetStatusItem[];
};

export type AnalyticsPeriod = {
  month: number;
  year: number;
};
