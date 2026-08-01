import type { AnalyticsPeriod } from "./analytics-types";

export const analyticsQueryKeys = {
  all: (userId: number) => ["analytics", userId] as const,
  summary: (userId: number, period: AnalyticsPeriod, currency: string) =>
    [...analyticsQueryKeys.all(userId), "summary", period, currency] as const,
  trend: (userId: number, months: number, endPeriod: AnalyticsPeriod, currency: string) =>
    [...analyticsQueryKeys.all(userId), "trend", months, endPeriod, currency] as const,
  budgetStatus: (userId: number, period: AnalyticsPeriod) =>
    [...analyticsQueryKeys.all(userId), "budget-status", period] as const,
};
