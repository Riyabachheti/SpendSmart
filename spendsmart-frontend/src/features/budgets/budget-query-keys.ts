import type { BudgetListParams } from "./budget-types";

export const budgetQueryKeys = {
  all: (userId: number) => ["budgets", userId] as const,
  list: (userId: number, params: BudgetListParams) =>
    [...budgetQueryKeys.all(userId), "list", params] as const,
};
