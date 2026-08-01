import { apiClient } from "@/lib/api-client";

import type {
  AnalyticsPeriod,
  BudgetStatusResponse,
  SpendingSummary,
  SpendingTrend,
} from "./analytics-types";

export async function getSpendingSummary(period: AnalyticsPeriod, currency = "INR") {
  const response = await apiClient.get<SpendingSummary>("/analytics/summary", {
    params: { month: period.month, year: period.year, currency },
  });
  return response.data;
}

export async function getSpendingTrend(
  months: number,
  endPeriod: AnalyticsPeriod,
  currency = "INR",
) {
  const response = await apiClient.get<SpendingTrend>("/analytics/trend", {
    params: {
      months,
      end_month: endPeriod.month,
      end_year: endPeriod.year,
      currency,
    },
  });
  return response.data;
}

export async function getBudgetStatus(period: AnalyticsPeriod) {
  const response = await apiClient.get<BudgetStatusResponse>("/analytics/budget-status", {
    params: { month: period.month, year: period.year },
  });
  return response.data;
}
