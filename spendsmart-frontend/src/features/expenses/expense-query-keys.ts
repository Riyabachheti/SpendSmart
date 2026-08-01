import type { ExpenseListParams } from "./expense-types";

export const expenseQueryKeys = {
  all: (userId: number) => ["expenses", userId] as const,
  list: (userId: number, params: ExpenseListParams) =>
    [...expenseQueryKeys.all(userId), "list", params] as const,
  pendingReview: (userId: number) =>
    [...expenseQueryKeys.all(userId), "pending-review"] as const,
  detail: (userId: number, expenseId: number) =>
    [...expenseQueryKeys.all(userId), "detail", expenseId] as const,
};
