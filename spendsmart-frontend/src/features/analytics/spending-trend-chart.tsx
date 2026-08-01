import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { useAuth } from "@/auth/use-auth";
import { getApiErrorMessage } from "@/lib/api-error";

import { getSpendingTrend } from "./analytics-api";
import { formatMoney, formatShortPeriod } from "./analytics-format";
import { AnalyticsPanelError, AnalyticsPanelSkeleton } from "./analytics-panel-state";
import { analyticsQueryKeys } from "./analytics-query-keys";
import type { AnalyticsPeriod } from "./analytics-types";

type TrendChartPoint = {
  expenseCount: number;
  label: string;
  value: number;
};

function compactMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function TrendTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TrendChartPoint | undefined;
  const currency = payload[0]?.unit;
  if (!point || typeof currency !== "string") return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-soft">
      <p className="font-medium">{label}</p>
      <p className="mt-1 tabular-nums">{formatMoney(point.value, currency)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {point.expenseCount} {point.expenseCount === 1 ? "expense" : "expenses"}
      </p>
    </div>
  );
}

export function SpendingTrendChart({
  monthsBack,
  period,
}: {
  monthsBack: number;
  period: AnalyticsPeriod;
}) {
  const { user } = useAuth();
  const userId = user!.id;
  const trend = useQuery({
    queryKey: analyticsQueryKeys.trend(userId, monthsBack, period, "INR"),
    queryFn: () => getSpendingTrend(monthsBack, period),
  });

  if (trend.isPending) return <AnalyticsPanelSkeleton variant="chart" />;
  if (trend.isError) {
    return (
      <AnalyticsPanelError onRetry={() => void trend.refetch()}>
        {getApiErrorMessage(trend.error, "Your spending trend couldn’t be loaded.")}
      </AnalyticsPanelError>
    );
  }

  const chartData: TrendChartPoint[] = trend.data.months.map((point) => ({
    expenseCount: point.expense_count,
    label: formatShortPeriod(point.month, point.year),
    value: Number(point.total_spent),
  }));
  const hasSpend = chartData.some((point) => point.value > 0);

  return (
    <div>
      {!hasSpend ? (
        <p className="pt-5 text-sm text-muted-foreground">
          No confirmed spending in this window yet. Zero-spend months are still plotted below.
        </p>
      ) : null}
      <div className="h-80 min-w-0 pt-5">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart accessibilityLayer data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              minTickGap={24}
              stroke="var(--muted-foreground)"
              tickLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              stroke="var(--muted-foreground)"
              tickFormatter={(value: number) => compactMoney(value, trend.data.currency)}
              tickLine={false}
              tick={{ fontSize: 12 }}
              width={70}
            />
            <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--border)" }} />
            <Line
              dataKey="value"
              dot={{ fill: "var(--card)", r: 4, strokeWidth: 2 }}
              stroke="var(--moss)"
              strokeWidth={2.5}
              type="monotone"
              unit={trend.data.currency}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Monthly confirmed spending trend</caption>
        <thead><tr><th>Month</th><th>Amount</th><th>Expenses</th></tr></thead>
        <tbody>
          {chartData.map((point) => (
            <tr key={point.label}>
              <th>{point.label}</th>
              <td>{formatMoney(point.value, trend.data.currency)}</td>
              <td>{point.expenseCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
