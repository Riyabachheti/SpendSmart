import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ReceiptText, WalletCards } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getApiErrorMessage } from "@/lib/api-error";

import { BudgetStatusPanel } from "../analytics/budget-status-panel";
import { CategoryBreakdownChart } from "../analytics/category-breakdown-chart";
import { formatMoney } from "../analytics/analytics-format";
import { SpendingTrendChart } from "../analytics/spending-trend-chart";
import type { AnalyticsPeriod } from "../analytics/analytics-types";
import { getExpenses, getPendingReviewExpenses } from "../expenses/expense-api";
import { expenseQueryKeys } from "../expenses/expense-query-keys";
import type { Expense } from "../expenses/expense-types";

const recentExpenseParams = { limit: 5 } as const;
const now = new Date();
const currentPeriod: AnalyticsPeriod = { month: now.getMonth() + 1, year: now.getFullYear() };
const currentYear = currentPeriod.year;
const years = Array.from({ length: 8 }, (_, index) => currentYear - 5 + index);
const monthNames = new Intl.DateTimeFormat("en-IN", { month: "long" });
const controlClassName =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatExpenseDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function getExpenseStatus(expense: Expense) {
  if (expense.is_verified) return null;
  if (expense.ocr_status === "pending" || expense.ocr_status === "processing") return "Reading receipt";
  if (expense.ocr_status === "failed") return "Receipt needs attention";
  return "Ready to review";
}

function RecentExpense({ expense }: { expense: Expense }) {
  const status = getExpenseStatus(expense);
  const title = expense.merchant_name?.trim() || expense.description?.trim() ||
    (expense.source === "ocr" ? "Receipt expense" : "Untitled expense");

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border/70 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatExpenseDate(expense.expense_date)}
          {status ? <span className="text-berry"> · {status}</span> : null}
        </p>
      </div>
      <p className="font-medium tabular-nums">
        {status && Number(expense.amount) === 0 ? "—" : formatMoney(expense.amount, expense.currency)}
      </p>
    </li>
  );
}

function PanelHeading({ eyebrow, id, title }: { eyebrow: string; id: string; title: string }) {
  return (
    <div className="border-b border-foreground pb-3">
      <p className="text-sm text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 text-2xl" id={id}>{title}</h2>
    </div>
  );
}

export function DashboardPage() {
  useDocumentTitle("Overview");
  const { user } = useAuth();
  const userId = user!.id;
  const firstName = user?.full_name?.trim().split(/\s+/)[0];
  const [period, setPeriod] = useState<AnalyticsPeriod>(currentPeriod);
  const [monthsBack, setMonthsBack] = useState(6);
  const recentExpenses = useQuery({
    queryKey: expenseQueryKeys.list(userId, recentExpenseParams),
    queryFn: () => getExpenses(recentExpenseParams),
  });
  const pendingReview = useQuery({
    queryKey: expenseQueryKeys.pendingReview(userId),
    queryFn: getPendingReviewExpenses,
  });

  return (
    <main id="main-content">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-medium tracking-wide text-berry">Overview</p>
        <h1 className="text-4xl leading-tight sm:text-5xl">Welcome back{firstName ? `, ${firstName}` : ""}.</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">Keep the record current. Clarity tends to follow.</p>
      </header>

      <nav aria-label="Quick actions" className="mt-10 grid border-y border-border md:grid-cols-2">
        <Link className="group flex items-center gap-4 border-b border-border py-5 md:border-r md:border-b-0 md:pr-8" to="/expenses">
          <ReceiptText aria-hidden="true" className="size-5 text-berry" />
          <span><span className="block font-medium">Record an expense</span><span className="mt-1 block text-sm text-muted-foreground">Add it manually or begin with a receipt.</span></span>
          <ArrowRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
        <Link className="group flex items-center gap-4 py-5 md:pl-8" to="/budgets">
          <WalletCards aria-hidden="true" className="size-5 text-moss" />
          <span><span className="block font-medium">Set a monthly boundary</span><span className="mt-1 block text-sm text-muted-foreground">Create or revisit your budgets.</span></span>
          <ArrowRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </nav>

      {pendingReview.data?.length ? (
        <div className="mt-10 flex flex-col justify-between gap-4 border-l-2 border-marigold py-1 pl-5 sm:flex-row sm:items-center">
          <div><p className="font-medium">{pendingReview.data.length === 1 ? "One receipt is ready for review." : `${pendingReview.data.length} receipts are ready for review.`}</p><p className="mt-1 text-sm text-muted-foreground">Confirm the details before they join your spending record.</p></div>
          <Link className="w-fit text-sm font-medium text-moss hover:text-foreground" to={`/expenses/receipts/${pendingReview.data[0].id}`}>Review receipts</Link>
        </div>
      ) : null}

      <section aria-label="Analytics period" className="mt-12 flex flex-col justify-between gap-4 border-y border-border py-5 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium">Dashboard period</p><p className="mt-1 text-sm text-muted-foreground">All insights below move with this month.</p></div>
        <div className="flex gap-3">
          <label className="text-sm"><span className="sr-only">Month</span><select className={controlClassName} onChange={(event) => setPeriod((value) => ({ ...value, month: Number(event.target.value) }))} value={period.month}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{monthNames.format(new Date(2020, index, 1))}</option>)}</select></label>
          <label className="text-sm"><span className="sr-only">Year</span><select className={controlClassName} onChange={(event) => setPeriod((value) => ({ ...value, year: Number(event.target.value) }))} value={period.year}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-x-12">
        <section aria-labelledby="category-breakdown-title"><PanelHeading eyebrow="Where it went" id="category-breakdown-title" title="By category" /><CategoryBreakdownChart period={period} /></section>
        <section aria-labelledby="budget-status-title"><PanelHeading eyebrow="Against your plan" id="budget-status-title" title="Budget status" /><BudgetStatusPanel period={period} /></section>
        <section aria-labelledby="spending-trend-title" className="lg:col-span-2">
          <div className="flex flex-col justify-between gap-4 border-b border-foreground pb-3 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">How it is changing</p><h2 className="mt-1 text-2xl" id="spending-trend-title">Spending trend</h2></div><label className="text-sm font-medium">Window <select className={`${controlClassName} ml-2`} onChange={(event) => setMonthsBack(Number(event.target.value))} value={monthsBack}><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select></label></div>
          <SpendingTrendChart monthsBack={monthsBack} period={period} />
        </section>
      </div>

      <section aria-labelledby="recent-expenses-title" className="mt-14">
        <div className="flex items-end justify-between gap-4 border-b border-foreground pb-3"><div><p className="text-sm text-muted-foreground">Latest activity</p><h2 className="mt-1 text-2xl" id="recent-expenses-title">Recent expenses</h2></div><Link className="text-sm font-medium text-moss hover:text-foreground" to="/expenses">View all</Link></div>
        {recentExpenses.isPending ? <p className="py-8 text-sm text-muted-foreground" role="status">Gathering your recent expenses…</p> : null}
        {recentExpenses.isError ? <div className="py-8"><p className="text-sm text-destructive" role="alert">{getApiErrorMessage(recentExpenses.error, "Your recent expenses couldn’t be loaded.")}</p><button className="mt-3 cursor-pointer text-sm font-medium text-moss hover:text-foreground" onClick={() => void recentExpenses.refetch()} type="button">Try again</button></div> : null}
        {recentExpenses.data?.items.length === 0 ? <div className="py-10"><p className="font-serif text-2xl">A clean page to begin with.</p><p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Record your first expense when you’re ready. One entry is enough to start making the month clearer.</p><Link className="mt-5 inline-block text-sm font-medium text-moss hover:text-foreground" to="/expenses">Add your first expense</Link></div> : null}
        {recentExpenses.data?.items.length ? <ul>{recentExpenses.data.items.map((expense) => <RecentExpense expense={expense} key={expense.id} />)}</ul> : null}
      </section>
    </main>
  );
}
