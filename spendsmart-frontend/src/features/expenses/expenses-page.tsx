import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

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

import { getCategories } from "../categories/category-api";
import { categoryQueryKeys } from "../categories/category-query-keys";
import { deleteExpense, getExpenses } from "./expense-api";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { expenseQueryKeys } from "./expense-query-keys";
import type { Expense, ExpenseListParams, ExpenseSource } from "./expense-types";
import { ReceiptUploadDialog } from "./receipt-upload-dialog";

const pageSize = 20;
const controlClassName =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function getWorkflowLabel(expense: Expense) {
  if (expense.source === "manual") return "Manual";
  if (expense.is_verified) return "Receipt";
  if (expense.ocr_status === "pending" || expense.ocr_status === "processing") return "Reading receipt";
  if (expense.ocr_status === "failed") return "Receipt failed";
  return "Needs review";
}

export function ExpensesPage() {
  useDocumentTitle("Expenses");

  const { user } = useAuth();
  const userId = user!.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedCategory = searchParams.get("category") ?? "";
  const categoryFilter = /^\d+$/.test(requestedCategory) ? requestedCategory : "";
  const requestedSource = searchParams.get("source") ?? "";
  const sourceFilter = requestedSource === "manual" || requestedSource === "ocr" ? requestedSource : "";
  const requestedStartDate = searchParams.get("start") ?? "";
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate) ? requestedStartDate : "";
  const requestedEndDate = searchParams.get("end") ?? "";
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedEndDate) ? requestedEndDate : "";

  const listParams = useMemo<ExpenseListParams>(
    () => ({
      skip: (page - 1) * pageSize,
      limit: pageSize,
      category_id: categoryFilter ? Number(categoryFilter) : undefined,
      source: sourceFilter ? (sourceFilter as ExpenseSource) : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    [categoryFilter, endDate, page, sourceFilter, startDate],
  );

  const expenses = useQuery({
    queryKey: expenseQueryKeys.list(userId, listParams),
    queryFn: () => getExpenses(listParams),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: categoryQueryKeys.all(userId),
    queryFn: getCategories,
    staleTime: 5 * 60_000,
  });

  const categoryNames = useMemo(
    () => new Map(categories.data?.map((category) => [category.id, category.name]) ?? []),
    [categories.data],
  );

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: async () => {
      if (expenses.data?.items.length === 1 && page > 1) {
        setPage(page - 1);
      }
      setExpenseToDelete(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(userId) });
    },
    onError: (error) => {
      setDeleteError(getApiErrorMessage(error, "The expense couldn’t be deleted."));
    },
  });

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name === "start" && value && endDate && endDate < value) {
      next.delete("end");
    }
    next.delete("page");
    setSearchParams(next, { replace: true });
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next);
  }

  function openCreateForm() {
    setSelectedExpense(null);
    setFormOpen(true);
  }

  function openEditForm(expense: Expense) {
    setSelectedExpense(expense);
    setFormOpen(true);
  }

  const hasFilters = Boolean(categoryFilter || sourceFilter || startDate || endDate);
  const resultStart = expenses.data && expenses.data.total > 0 ? expenses.data.skip + 1 : 0;
  const resultEnd = expenses.data ? expenses.data.skip + expenses.data.items.length : 0;

  return (
    <main id="main-content">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-medium tracking-wide text-berry">Expenses</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">Your spending record.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Add what you spend, then return when a detail needs correcting.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button className="h-11 px-4" onClick={() => setUploadOpen(true)} variant="outline">
            <ReceiptText aria-hidden="true" />
            Upload receipt
          </Button>
          <Button className="h-11 px-4" onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Add manually
          </Button>
        </div>
      </header>

      <section aria-label="Expense filters" className="mt-10 border-y border-border py-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">
            Category
            <select
              className={`${controlClassName} mt-2 w-full`}
              disabled={categories.isPending}
              onChange={(event) => setFilter("category", event.target.value)}
              value={categoryFilter}
            >
              <option value="">All categories</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Source
            <select
              className={`${controlClassName} mt-2 w-full`}
              onChange={(event) => setFilter("source", event.target.value)}
              value={sourceFilter}
            >
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="ocr">Receipt</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            From
            <Input
              className="mt-2 h-10 bg-background px-3"
              onChange={(event) => setFilter("start", event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="text-sm font-medium">
            To
            <Input
              className="mt-2 h-10 bg-background px-3"
              min={startDate || undefined}
              onChange={(event) => setFilter("end", event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        </div>
        {hasFilters ? (
          <button
            className="mt-4 cursor-pointer text-sm font-medium text-moss hover:text-foreground"
            onClick={() => setSearchParams({}, { replace: true })}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </section>

      <section aria-labelledby="expense-history-title" className="mt-10">
        <div className="flex items-end justify-between gap-4 border-b border-foreground pb-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {expenses.data
                ? `${resultStart}–${resultEnd} of ${expenses.data.total}`
                : "Your history"}
            </p>
            <h2 className="mt-1 text-2xl" id="expense-history-title">All expenses</h2>
          </div>
        </div>

        {expenses.isPending ? (
          <p className="py-10 text-sm text-muted-foreground" role="status">Loading expenses…</p>
        ) : null}

        {expenses.isError ? (
          <div className="py-10">
            <p className="text-sm text-destructive" role="alert">
              {getApiErrorMessage(expenses.error, "Your expenses couldn’t be loaded.")}
            </p>
            <button className="mt-3 cursor-pointer text-sm font-medium text-moss" onClick={() => void expenses.refetch()} type="button">
              Try again
            </button>
          </div>
        ) : null}

        {expenses.data?.items.length === 0 ? (
          <div className="py-12">
            <p className="font-serif text-2xl">{hasFilters ? "No expenses match these filters." : "Nothing recorded yet."}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {hasFilters ? "Try widening the dates or clearing a filter." : "Add your first expense when you’re ready."}
            </p>
          </div>
        ) : null}

        {expenses.data && expenses.data.items.length > 0 ? (
          <ul className={expenses.isFetching ? "opacity-60" : undefined}>
            {expenses.data.items.map((expense) => {
              const isProcessing = expense.source === "ocr" &&
                (expense.ocr_status === "pending" || expense.ocr_status === "processing");
              const title = expense.merchant_name?.trim() || expense.description?.trim() || "Untitled expense";
              return (
                <li className="grid gap-3 border-b border-border/70 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6" key={expense.id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(expense.expense_date)} · {expense.category_id ? categoryNames.get(expense.category_id) ?? "Category" : "Uncategorized"}
                      <span className={expense.is_verified ? "" : " text-berry"}> · {getWorkflowLabel(expense)}</span>
                    </p>
                    {expense.description && expense.merchant_name ? (
                      <p className="mt-1 truncate text-sm text-muted-foreground">{expense.description}</p>
                    ) : null}
                  </div>
                  <p className="font-medium tabular-nums sm:text-right">
                    {isProcessing && Number(expense.amount) === 0 ? "—" : formatMoney(expense.amount, expense.currency)}
                  </p>
                  <div className="flex gap-2 sm:justify-end">
                    {expense.source === "ocr" && !expense.is_verified ? (
                      <Link
                        className="inline-flex h-7 items-center rounded-md px-2 text-sm font-medium text-moss hover:bg-muted hover:text-foreground"
                        to={`/expenses/receipts/${expense.id}`}
                      >
                        {isProcessing ? "View status" : "Review"}
                      </Link>
                    ) : (
                      <Button
                        aria-label={`Edit ${title}`}
                        onClick={() => openEditForm(expense)}
                        size="icon-sm"
                        title="Edit expense"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    )}
                    {!isProcessing ? (
                      <Button
                        aria-label={`Delete ${title}`}
                        onClick={() => { setDeleteError(null); setExpenseToDelete(expense); }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {expenses.data && expenses.data.total > pageSize ? (
          <nav aria-label="Expense pages" className="mt-8 flex items-center justify-between gap-4">
            <Button disabled={page === 1 || expenses.isFetching} onClick={() => setPage(page - 1)} variant="outline">Previous</Button>
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <Button disabled={!expenses.data.has_more || expenses.isFetching} onClick={() => setPage(page + 1)} variant="outline">Next</Button>
          </nav>
        ) : null}
      </section>

      <ExpenseFormDialog
        categories={categories.data ?? []}
        expense={selectedExpense}
        onOpenChange={setFormOpen}
        open={formOpen}
        userId={userId}
      />

      <ReceiptUploadDialog
        onOpenChange={setUploadOpen}
        open={uploadOpen}
        userId={userId}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setExpenseToDelete(null);
        }}
        open={Boolean(expenseToDelete)}
      >
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Delete this expense?</DialogTitle>
            <DialogDescription>This removes it permanently from your spending record.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <DialogFooter className="-mx-6 -mb-6 p-6">
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => expenseToDelete && deleteMutation.mutate(expenseToDelete.id)}
              variant="destructive"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete expense"}
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={() => setExpenseToDelete(null)} variant="outline">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
