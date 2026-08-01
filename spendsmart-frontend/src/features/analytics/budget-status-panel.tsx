import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { getApiErrorMessage } from "@/lib/api-error";

import { CategoryIcon } from "../categories/category-icon";
import { getBudgetStatus } from "./analytics-api";
import { formatMoney, formatPeriod } from "./analytics-format";
import { AnalyticsPanelError, AnalyticsPanelSkeleton } from "./analytics-panel-state";
import { analyticsQueryKeys } from "./analytics-query-keys";
import type { AnalyticsPeriod, BudgetStatusItem } from "./analytics-types";

function BudgetRow({ currency, item }: { currency: string; item: BudgetStatusItem }) {
  const parsedPercent = item.percent_used === null ? null : Number(item.percent_used);
  const percent = parsedPercent === null || !Number.isFinite(parsedPercent)
    ? null
    : Math.max(0, Math.min(parsedPercent, 100));
  const overage = Math.abs(Number(item.remaining_amount));

  return (
    <li>
      <div className="flex flex-col justify-between gap-2 text-sm sm:flex-row sm:items-center">
        <span className="flex items-center gap-2 font-medium">
          {item.category_id === null ? null : (
            <span className="flex size-4 items-center justify-center overflow-hidden text-muted-foreground">
              <CategoryIcon className="size-4" icon={item.category_icon} />
            </span>
          )}
          {item.category_name}
        </span>
        <span className={item.is_over_budget ? "text-destructive" : "text-muted-foreground"}>
          {formatMoney(item.actual_amount, currency)} of {formatMoney(item.budget_amount, currency)}
        </span>
      </div>
      <div
        aria-label={item.percent_used === null ? "No percentage available" : `${item.percent_used}% used`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent ?? undefined}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        {percent === null ? (
          <div className="h-full w-full bg-border" />
        ) : (
          <div
            className={`h-full rounded-full ${item.is_over_budget ? "bg-destructive" : "bg-moss"}`}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      {item.is_over_budget ? (
        <p className="mt-1 text-xs text-destructive">{formatMoney(overage, currency)} over budget</p>
      ) : item.percent_used === null ? (
        <p className="mt-1 text-xs text-muted-foreground">A zero budget has no usable percentage.</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatMoney(item.remaining_amount, currency)} remaining
        </p>
      )}
    </li>
  );
}

export function BudgetStatusPanel({ period }: { period: AnalyticsPeriod }) {
  const { user } = useAuth();
  const userId = user!.id;
  const status = useQuery({
    queryKey: analyticsQueryKeys.budgetStatus(userId, period),
    queryFn: () => getBudgetStatus(period),
  });

  if (status.isPending) return <AnalyticsPanelSkeleton />;
  if (status.isError) {
    return (
      <AnalyticsPanelError onRetry={() => void status.refetch()}>
        {getApiErrorMessage(status.error, "Your budget status couldn’t be loaded.")}
      </AnalyticsPanelError>
    );
  }

  const items = status.data.overall
    ? [status.data.overall, ...status.data.categories]
    : status.data.categories;

  if (items.length === 0) {
    return (
      <div className="py-10 text-sm leading-6 text-muted-foreground">
        <p>No budgets set for {formatPeriod(period.month, period.year)}.</p>
        <Link className="mt-3 inline-block font-medium text-moss hover:text-foreground" to="/budgets">
          Set a monthly budget
        </Link>
      </div>
    );
  }

  return <ul className="space-y-6 py-5">{items.map((item) => <BudgetRow currency={status.data.currency} item={item} key={item.budget_id} />)}</ul>;
}
