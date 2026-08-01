export type Budget = {
  id: number;
  user_id: number;
  category_id: number | null;
  amount: string;
  month: number;
  year: number;
};

export type BudgetCreateInput = {
  amount: string;
  category_id: number | null;
  month: number;
  year: number;
};

export type BudgetListParams = {
  month?: number;
  year?: number;
};
