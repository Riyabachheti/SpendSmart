import { apiClient } from "@/lib/api-client";

import type { Category, CategoryWriteInput } from "./category-types";

export async function getCategories() {
  const response = await apiClient.get<Category[]>("/categories");
  return response.data;
}

export async function createCategory(input: CategoryWriteInput) {
  const response = await apiClient.post<Category>("/categories", input);
  return response.data;
}

export async function updateCategory(categoryId: number, input: CategoryWriteInput) {
  const response = await apiClient.patch<Category>(`/categories/${categoryId}`, input);
  return response.data;
}

export async function deleteCategory(categoryId: number) {
  await apiClient.delete(`/categories/${categoryId}`);
}
