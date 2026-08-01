import { apiClient } from "@/lib/api-client";

import type { Budget, BudgetCreateInput, BudgetListParams } from "./budget-types";

export async function getBudgets(params: BudgetListParams = {}) {
  const response = await apiClient.get<Budget[]>("/budgets", { params });
  return response.data;
}

export async function createBudget(input: BudgetCreateInput) {
  const response = await apiClient.post<Budget>("/budgets", input);
  return response.data;
}

export async function updateBudget(budgetId: number, amount: string) {
  const response = await apiClient.patch<Budget>(`/budgets/${budgetId}`, { amount });
  return response.data;
}

export async function deleteBudget(budgetId: number) {
  await apiClient.delete(`/budgets/${budgetId}`);
}
