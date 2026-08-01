import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { useAuth } from "@/auth/use-auth";
import { getApiErrorMessage } from "@/lib/api-error";

import { CategoryIcon } from "../categories/category-icon";
import { getSpendingSummary } from "./analytics-api";
import { formatMoney, formatPeriod } from "./analytics-format";
import { AnalyticsPanelError, AnalyticsPanelSkeleton } from "./analytics-panel-state";
import { analyticsQueryKeys } from "./analytics-query-keys";
import type { AnalyticsPeriod } from "./analytics-types";

const chartColors = Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`);

export function CategoryBreakdownChart({ period }: { period: AnalyticsPeriod }) {
  const { user } = useAuth();
  const userId = user!.id;
  const summary = useQuery({
    queryKey: analyticsQueryKeys.summary(userId, period, "INR"),
    queryFn: () => getSpendingSummary(period),
  });

  if (summary.isPending) return <AnalyticsPanelSkeleton variant="chart" />;
  if (summary.isError) {
    return (
      <AnalyticsPanelError onRetry={() => void summary.refetch()}>
        {getApiErrorMessage(summary.error, "Your category breakdown couldn’t be loaded.")}
      </AnalyticsPanelError>
    );
  }

  if (summary.data.by_category.length === 0) {
    return (
      <p className="py-10 text-sm leading-6 text-muted-foreground">
        No confirmed expenses yet for {formatPeriod(period.month, period.year)}.
      </p>
    );
  }

  const chartData = summary.data.by_category.map((category, index) => ({
    ...category,
    value: Number(category.amount),
    color: category.category_id === null ? "var(--muted-foreground)" : chartColors[index % 8],
  }));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(13rem,0.9fr)_minmax(12rem,1.1fr)]">
      <div className="relative h-64 min-w-0">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius="62%"
              nameKey="category_name"
              outerRadius="88%"
              stroke="var(--card)"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell fill={entry.color} key={entry.category_id ?? "uncategorized"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          <span className="text-xs text-muted-foreground">Total spent</span>
          <span className="mt-1 font-serif text-xl leading-tight tabular-nums">
            {formatMoney(summary.data.total_spent, summary.data.currency)}
          </span>
        </div>
      </div>

      <ul aria-label="Category spending legend" className="space-y-3">
        {chartData.map((category) => (
          <li
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-sm"
            key={category.category_id ?? "uncategorized"}
          >
            <span className="flex size-7 items-center justify-center overflow-hidden rounded-full" style={{ color: category.color }}>
              <CategoryIcon className="size-4" icon={category.category_icon} />
            </span>
            <span className="truncate">{category.category_name}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(category.amount, summary.data.currency)}
            </span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>Confirmed spending by category for {formatPeriod(period.month, period.year)}</caption>
        <thead><tr><th>Category</th><th>Amount</th><th>Expenses</th></tr></thead>
        <tbody>
          {chartData.map((category) => (
            <tr key={category.category_id ?? "uncategorized"}>
              <th>{category.category_name}</th>
              <td>{formatMoney(category.amount, summary.data.currency)}</td>
              <td>{category.expense_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
