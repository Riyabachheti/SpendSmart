import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getApiErrorMessage } from "@/lib/api-error";

import { CategoryIcon } from "../categories/category-icon";

import { getCategories } from "../categories/category-api";
import { categoryQueryKeys } from "../categories/category-query-keys";
import { deleteBudget, getBudgets } from "./budget-api";
import { BudgetFormDialog } from "./budget-form-dialog";
import { budgetQueryKeys } from "./budget-query-keys";
import type { Budget, BudgetListParams } from "./budget-types";

const periodFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});
const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function getCurrentPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function parsePeriod(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return getCurrentPeriod();
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return getCurrentPeriod();
  return { month, year };
}

function serializePeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function BudgetsPage() {
  useDocumentTitle("Budgets");

  const { user } = useAuth();
  const userId = user!.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { month, year } = parsePeriod(searchParams.get("period"));
  const [formOpen, setFormOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const params = useMemo<BudgetListParams>(() => ({ month, year }), [month, year]);
  const budgets = useQuery({
    queryKey: budgetQueryKeys.list(userId, params),
    queryFn: () => getBudgets(params),
  });
  const categories = useQuery({
    queryKey: categoryQueryKeys.all(userId),
    queryFn: getCategories,
    staleTime: 5 * 60_000,
  });
  const categoryMap = useMemo(
    () => new Map(categories.data?.map((category) => [category.id, category]) ?? []),
    [categories.data],
  );
  const orderedBudgets = useMemo(
    () => [...(budgets.data ?? [])].sort((left, right) => {
      if (left.category_id === null) return -1;
      if (right.category_id === null) return 1;
      return (categoryMap.get(left.category_id)?.name ?? "").localeCompare(
        categoryMap.get(right.category_id)?.name ?? "",
      );
    }),
    [budgets.data, categoryMap],
  );

  const periodLabel = periodFormatter.format(new Date(year, month - 1, 1));
  const periodValue = serializePeriod(year, month);

  const deleteMutation = useMutation({
    mutationFn: deleteBudget,
    onSuccess: async () => {
      setBudgetToDelete(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all(userId) });
    },
    onError: (error) => {
      setDeleteError(getApiErrorMessage(error, "The budget couldn’t be deleted."));
    },
  });

  function setPeriod(nextYear: number, nextMonth: number) {
    setSearchParams({ period: serializePeriod(nextYear, nextMonth) });
  }

  function shiftMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1);
    const nextYear = next.getFullYear();
    if (nextYear < 2000 || nextYear > 2100) return;
    setPeriod(nextYear, next.getMonth() + 1);
  }

  function openCreateForm() {
    setSelectedBudget(null);
    setFormOpen(true);
  }

  function openEditForm(budget: Budget) {
    setSelectedBudget(budget);
    setFormOpen(true);
  }

  function getBudgetName(budget: Budget) {
    if (budget.category_id === null) return "Overall monthly budget";
    return categoryMap.get(budget.category_id)?.name ?? "Category budget";
  }

  return (
    <main id="main-content">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-medium tracking-wide text-berry">Budgets</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">A boundary for the month.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Set an overall amount or give individual categories their own limits. Budgets are recorded in INR.
          </p>
        </div>
        <Button className="h-11 w-fit px-4" onClick={openCreateForm}>
          <Plus aria-hidden="true" />
          Add budget
        </Button>
      </header>

      <section aria-label="Budget month" className="mt-10 flex flex-wrap items-end gap-3 border-y border-border py-5">
        <Button aria-label="Previous month" disabled={year === 2000 && month === 1} onClick={() => shiftMonth(-1)} size="icon" variant="ghost">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <label className="text-sm font-medium">
          Month
          <Input
            className="mt-2 h-10 w-44 bg-background px-3"
            max="2100-12"
            min="2000-01"
            onChange={(event) => {
              const next = parsePeriod(event.target.value);
              setPeriod(next.year, next.month);
            }}
            type="month"
            value={periodValue}
          />
        </label>
        <Button aria-label="Next month" disabled={year === 2100 && month === 12} onClick={() => shiftMonth(1)} size="icon" variant="ghost">
          <ChevronRight aria-hidden="true" />
        </Button>
        <p className="ml-auto pb-2 font-serif text-xl">{periodLabel}</p>
      </section>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,0.65fr)] lg:gap-20">
        <section aria-labelledby="budget-list-title">
          <div className="border-b border-foreground pb-3">
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
            <h2 className="mt-1 text-2xl" id="budget-list-title">Monthly budgets</h2>
          </div>

          {budgets.isPending ? <p className="py-10 text-sm text-muted-foreground" role="status">Loading budgets…</p> : null}
          {budgets.isError ? (
            <div className="py-10">
              <p className="text-sm text-destructive" role="alert">{getApiErrorMessage(budgets.error, "Your budgets couldn’t be loaded.")}</p>
              <button className="mt-3 cursor-pointer text-sm font-medium text-moss" onClick={() => void budgets.refetch()} type="button">Try again</button>
            </div>
          ) : null}
          {budgets.data?.length === 0 ? (
            <div className="py-12">
              <p className="font-serif text-2xl">No boundaries set for {periodLabel}.</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Begin with one overall amount or choose a category that benefits from a little structure.</p>
              <button className="mt-5 cursor-pointer text-sm font-medium text-moss" onClick={openCreateForm} type="button">Add the first budget</button>
            </div>
          ) : null}
          {orderedBudgets.length > 0 ? (
            <ul>
              {orderedBudgets.map((budget) => {
                const category = budget.category_id === null ? null : categoryMap.get(budget.category_id);
                const title = getBudgetName(budget);
                return (
                  <li className="grid gap-3 border-b border-border/70 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6" key={budget.id}>
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        {category ? <CategoryIcon className="size-4 text-moss" icon={category.icon} /> : null}
                        {title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{budget.category_id === null ? "Across every category" : "Category budget"}</p>
                    </div>
                    <p className="font-medium tabular-nums sm:text-right">{moneyFormatter.format(Number(budget.amount))}</p>
                    <div className="flex gap-2 sm:justify-end">
                      <Button aria-label={`Edit ${title}`} onClick={() => openEditForm(budget)} size="icon-sm" variant="ghost"><Pencil aria-hidden="true" /></Button>
                      <Button aria-label={`Delete ${title}`} onClick={() => { setDeleteError(null); setBudgetToDelete(budget); }} size="icon-sm" variant="ghost"><Trash2 aria-hidden="true" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <aside className="border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <p className="text-sm font-medium tracking-wide text-berry">Keep it useful</p>
          <h2 className="mt-3 text-2xl leading-8">A budget is a decision, not a score.</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Adjust the amount when circumstances change. SpendSmart keeps the boundary; it does not grade the month.
          </p>
        </aside>
      </div>

      <BudgetFormDialog
        budget={selectedBudget}
        budgets={budgets.data ?? []}
        categories={categories.data ?? []}
        month={month}
        onOpenChange={setFormOpen}
        open={formOpen}
        periodLabel={periodLabel}
        userId={userId}
        year={year}
      />

      <Dialog onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setBudgetToDelete(null); }} open={Boolean(budgetToDelete)}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Delete this budget?</DialogTitle>
            <DialogDescription>This removes the boundary for {periodLabel}. Your expenses are not affected.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <DialogFooter className="-mx-6 -mb-6 p-6">
            <Button disabled={deleteMutation.isPending} onClick={() => budgetToDelete && deleteMutation.mutate(budgetToDelete.id)} variant="destructive">{deleteMutation.isPending ? "Deleting…" : "Delete budget"}</Button>
            <Button disabled={deleteMutation.isPending} onClick={() => setBudgetToDelete(null)} variant="outline">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
