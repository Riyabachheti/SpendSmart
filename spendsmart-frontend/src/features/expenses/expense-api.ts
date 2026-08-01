import { apiClient } from "@/lib/api-client";

import type {
  Expense,
  ExpenseListParams,
  ExpensePage,
  ExpenseUpdateInput,
  ExpenseWriteInput,
  ReceiptUploadResponse,
} from "./expense-types";

export async function getExpenses(params: ExpenseListParams = {}) {
  const response = await apiClient.get<ExpensePage>("/expenses", { params });
  return response.data;
}

export async function getPendingReviewExpenses() {
  const response = await apiClient.get<Expense[]>("/expenses/pending-review");
  return response.data;
}

export async function createExpense(input: ExpenseWriteInput) {
  const response = await apiClient.post<Expense>("/expenses", input);
  return response.data;
}

export async function updateExpense(expenseId: number, input: ExpenseUpdateInput) {
  const response = await apiClient.patch<Expense>(`/expenses/${expenseId}`, input);
  return response.data;
}

export async function deleteExpense(expenseId: number) {
  await apiClient.delete(`/expenses/${expenseId}`);
}

export async function getExpense(expenseId: number) {
  const response = await apiClient.get<Expense>(`/expenses/${expenseId}`);
  return response.data;
}

export async function uploadReceipt(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<ReceiptUploadResponse>(
    "/expenses/receipts",
    formData,
  );
  return response.data;
}

export async function retryReceiptOcr(expenseId: number) {
  const response = await apiClient.post<ReceiptUploadResponse>(
    `/expenses/${expenseId}/retry-ocr`,
  );
  return response.data;
}

export async function confirmExpense(expenseId: number) {
  const response = await apiClient.post<Expense>(`/expenses/${expenseId}/confirm`);
  return response.data;
}
