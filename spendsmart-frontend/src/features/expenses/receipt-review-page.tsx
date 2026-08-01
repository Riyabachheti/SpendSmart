import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSearch, RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getApiErrorMessage } from "@/lib/api-error";

import { getCategories } from "../categories/category-api";
import { categoryQueryKeys } from "../categories/category-query-keys";
import {
  confirmExpense,
  getExpense,
  retryReceiptOcr,
  updateExpense,
} from "./expense-api";
import { expenseQueryKeys } from "./expense-query-keys";
import type { Expense, ExpenseWriteInput } from "./expense-types";

type ReviewFormState = {
  amount: string;
  currency: string;
  categoryId: string;
  merchantName: string;
  expenseDate: string;
  description: string;
};

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function getFormState(expense: Expense): ReviewFormState {
  return {
    amount: expense.amount,
    currency: expense.currency,
    categoryId: expense.category_id?.toString() ?? "",
    merchantName: expense.merchant_name ?? "",
    expenseDate: expense.expense_date,
    description: expense.description ?? "",
  };
}

function ReceiptImage({ expense }: { expense: Expense }) {
  if (!expense.receipt_url) return null;

  return (
    <figure>
      <img
        alt="Uploaded receipt"
        className="max-h-[40rem] w-full rounded-xl bg-muted object-contain"
        referrerPolicy="no-referrer"
        src={expense.receipt_url}
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Original receipt — use it to check every extracted detail.
      </figcaption>
    </figure>
  );
}

export function ReceiptReviewPage() {
  useDocumentTitle("Review receipt");

  const { expenseId: expenseIdParam } = useParams();
  const expenseId = Number(expenseIdParam);
  const isValidExpenseId = Number.isInteger(expenseId) && expenseId > 0;
  const { user } = useAuth();
  const userId = user!.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedExpenseId = useRef<number | null>(null);
  const [form, setForm] = useState<ReviewFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const expense = useQuery({
    queryKey: expenseQueryKeys.detail(userId, expenseId),
    queryFn: () => getExpense(expenseId),
    enabled: isValidExpenseId,
    refetchInterval: (query) => {
      const current = query.state.data;
      return current?.ocr_status === "pending" || current?.ocr_status === "processing"
        ? 2_000
        : false;
    },
  });
  const categories = useQuery({
    queryKey: categoryQueryKeys.all(userId),
    queryFn: getCategories,
    enabled: expense.data?.ocr_status === "completed" && !expense.data.is_verified,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (
      expense.data?.ocr_status === "completed" &&
      !expense.data.is_verified &&
      initializedExpenseId.current !== expense.data.id
    ) {
      initializedExpenseId.current = expense.data.id;
      setForm(getFormState(expense.data));
    }
  }, [expense.data]);

  const retryMutation = useMutation({
    mutationFn: () => retryReceiptOcr(expenseId),
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({
        queryKey: expenseQueryKeys.detail(userId, expenseId),
      });
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "OCR couldn’t be restarted. Please try again."));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (input: ExpenseWriteInput) => {
      await updateExpense(expenseId, input);
      return confirmExpense(expenseId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(userId) });
      navigate("/expenses", { replace: true });
    },
    onError: (error) => {
      void queryClient.invalidateQueries({
        queryKey: expenseQueryKeys.detail(userId, expenseId),
      });
      setFormError(
        getApiErrorMessage(error, "The receipt couldn’t be confirmed. Review the details and try again."),
      );
    },
  });

  function updateField<Key extends keyof ReviewFormState>(
    key: Key,
    value: ReviewFormState[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!form) return;

    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError("Enter the correct amount before confirming this receipt.");
      return;
    }
    if (!form.categoryId) {
      setFormError("Choose a category before confirming this receipt.");
      return;
    }
    const currency = form.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setFormError("Use a three-letter currency code, such as INR.");
      return;
    }

    confirmMutation.mutate({
      amount: form.amount,
      currency,
      category_id: Number(form.categoryId),
      merchant_name: form.merchantName.trim() || null,
      expense_date: form.expenseDate,
      description: form.description.trim() || null,
    });
  }

  if (!isValidExpenseId) {
    return (
      <main id="main-content">
        <h1 className="text-4xl">That receipt address is not valid.</h1>
        <Link className="mt-6 inline-block font-medium text-moss" to="/expenses">Return to expenses</Link>
      </main>
    );
  }

  if (expense.isPending) {
    return <main id="main-content"><p className="text-sm text-muted-foreground" role="status">Opening your receipt…</p></main>;
  }

  if (expense.isError) {
    return (
      <main id="main-content" className="max-w-xl">
        <h1 className="text-4xl">This receipt could not be opened.</h1>
        <p className="mt-4 text-sm text-destructive" role="alert">
          {getApiErrorMessage(expense.error, "Check your connection and try again.")}
        </p>
        <Button className="mt-6" onClick={() => void expense.refetch()} variant="outline">Try again</Button>
      </main>
    );
  }

  const currentExpense = expense.data;

  if (currentExpense.source !== "ocr") {
    return (
      <main id="main-content" className="max-w-xl">
        <h1 className="text-4xl">This expense does not have a receipt review.</h1>
        <Link className="mt-6 inline-block font-medium text-moss" to="/expenses">Return to expenses</Link>
      </main>
    );
  }

  if (currentExpense.is_verified) {
    return (
      <main id="main-content" className="max-w-xl">
        <CheckCircle2 aria-hidden="true" className="mb-6 size-8 text-moss" />
        <h1 className="text-4xl">This receipt is already confirmed.</h1>
        <p className="mt-4 text-muted-foreground">It is safely part of your spending record.</p>
        <Link className="mt-6 inline-block font-medium text-moss" to="/expenses">Return to expenses</Link>
      </main>
    );
  }

  if (currentExpense.ocr_status === "pending" || currentExpense.ocr_status === "processing") {
    return (
      <main id="main-content" className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:gap-20">
        <div className="max-w-xl pt-6">
          <FileSearch aria-hidden="true" className="mb-6 size-8 text-berry" />
          <p className="mb-3 text-sm font-medium tracking-wide text-berry">Receipt in progress</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">Reading the details.</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground" role="status">
            {currentExpense.ocr_status === "pending"
              ? "Your receipt is waiting its turn. This page will update automatically."
              : "SpendSmart is finding the merchant, amount, and date. This page will update automatically."}
          </p>
          <Link className="mt-8 inline-block text-sm font-medium text-moss" to="/expenses">Return to expenses</Link>
        </div>
        <ReceiptImage expense={currentExpense} />
      </main>
    );
  }

  if (currentExpense.ocr_status === "failed") {
    return (
      <main id="main-content" className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="max-w-xl pt-6">
          <p className="mb-3 text-sm font-medium tracking-wide text-berry">Receipt needs attention</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">The receipt couldn’t be read.</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Try OCR once more. If the image is unclear, you can return and record the expense manually.
          </p>
          {formError ? <p className="mt-5 text-sm text-destructive" role="alert">{formError}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button disabled={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
              <RefreshCw aria-hidden="true" />
              {retryMutation.isPending ? "Retrying…" : "Retry OCR"}
            </Button>
            <Button render={<Link to="/expenses" />} variant="outline">Return to expenses</Button>
          </div>
        </div>
        <ReceiptImage expense={currentExpense} />
      </main>
    );
  }

  return (
    <main id="main-content">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-medium tracking-wide text-berry">Review receipt</p>
        <h1 className="text-4xl leading-tight sm:text-5xl">Check what SpendSmart found.</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          The receipt is not part of your verified record until you confirm these details.
        </p>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <ReceiptImage expense={currentExpense} />
        {form ? (
          <form className="space-y-5 border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12" onSubmit={handleConfirm}>
            {formError ? (
              <p className="border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">{formError}</p>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <label className="text-sm font-medium">Amount
                <Input className="mt-2 h-11 bg-card px-3.5" inputMode="decimal" min="0.01" onChange={(event) => updateField("amount", event.target.value)} required step="0.01" type="number" value={form.amount} />
              </label>
              <label className="text-sm font-medium">Currency
                <Input className="mt-2 h-11 bg-card px-3.5 uppercase" maxLength={3} minLength={3} onChange={(event) => updateField("currency", event.target.value)} required value={form.currency} />
              </label>
            </div>
            <label className="block text-sm font-medium">Merchant or payee
              <Input className="mt-2 h-11 bg-card px-3.5" onChange={(event) => updateField("merchantName", event.target.value)} value={form.merchantName} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium">Date
                <Input className="mt-2 h-11 bg-card px-3.5" onChange={(event) => updateField("expenseDate", event.target.value)} required type="date" value={form.expenseDate} />
              </label>
              <label className="text-sm font-medium">Category
                <select className={`${selectClassName} mt-2`} disabled={categories.isPending || categories.isError} onChange={(event) => updateField("categoryId", event.target.value)} required value={form.categoryId}>
                  <option value="">Choose a category</option>
                  {categories.data?.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">Note
              <textarea className="mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-card px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" onChange={(event) => updateField("description", event.target.value)} value={form.description} />
            </label>
            {categories.isError ? <p className="text-sm text-destructive" role="alert">Categories couldn’t be loaded. Try refreshing before confirming.</p> : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button disabled={confirmMutation.isPending || categories.isError} size="lg" type="submit">
                {confirmMutation.isPending ? "Confirming…" : "Confirm expense"}
              </Button>
              <Button render={<Link to="/expenses" />} size="lg" variant="outline">Review later</Button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
