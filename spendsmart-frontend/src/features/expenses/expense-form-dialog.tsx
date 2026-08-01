import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { getApiErrorMessage } from "@/lib/api-error";

import type { Category } from "../categories/category-types";
import { createExpense, updateExpense } from "./expense-api";
import { expenseQueryKeys } from "./expense-query-keys";
import type { Expense, ExpenseWriteInput } from "./expense-types";

type ExpenseFormDialogProps = {
  categories: Category[];
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  userId: number;
};

type ExpenseFormState = {
  amount: string;
  currency: string;
  categoryId: string;
  merchantName: string;
  expenseDate: string;
  description: string;
};

const fieldClassName =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialState(expense: Expense | null): ExpenseFormState {
  return {
    amount: expense?.amount ?? "",
    currency: expense?.currency ?? "INR",
    categoryId: expense?.category_id?.toString() ?? "",
    merchantName: expense?.merchant_name ?? "",
    expenseDate: expense?.expense_date ?? getLocalDate(),
    description: expense?.description ?? "",
  };
}

export function ExpenseFormDialog({
  categories,
  expense,
  onOpenChange,
  open,
  userId,
}: ExpenseFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => getInitialState(expense));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(expense));
      setErrorMessage(null);
    }
  }, [expense, open]);

  const mutation = useMutation({
    mutationFn: (input: ExpenseWriteInput) =>
      expense ? updateExpense(expense.id, input) : createExpense(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(userId) });
      onOpenChange(false);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, `The expense couldn’t be ${expense ? "updated" : "saved"}.`),
      );
    },
  });

  function updateField<Key extends keyof ExpenseFormState>(
    key: Key,
    value: ExpenseFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setErrorMessage("Enter an amount greater than zero.");
      return;
    }

    const currency = form.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setErrorMessage("Use a three-letter currency code, such as INR.");
      return;
    }

    mutation.mutate({
      amount: form.amount,
      currency,
      category_id: form.categoryId ? Number(form.categoryId) : null,
      merchant_name: form.merchantName.trim() || null,
      expense_date: form.expenseDate,
      description: form.description.trim() || null,
    });
  }

  const title = expense ? "Edit expense" : "Add an expense";

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {expense
              ? "Correct the details that belong in your spending record."
              : "Record what you spent. You can refine the details later."}
          </DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-5" id="expense-form" onSubmit={handleSubmit}>
          {errorMessage ? (
            <p className="border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <label className="block text-sm font-medium">
              Amount
              <Input
                className="mt-2 h-11 bg-card px-3.5"
                inputMode="decimal"
                min="0.01"
                onChange={(event) => updateField("amount", event.target.value)}
                required
                step="0.01"
                type="number"
                value={form.amount}
              />
            </label>
            <label className="block text-sm font-medium">
              Currency
              <Input
                autoCapitalize="characters"
                className="mt-2 h-11 bg-card px-3.5 uppercase"
                maxLength={3}
                minLength={3}
                onChange={(event) => updateField("currency", event.target.value)}
                required
                value={form.currency}
              />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Merchant or payee
            <Input
              className="mt-2 h-11 bg-card px-3.5"
              onChange={(event) => updateField("merchantName", event.target.value)}
              placeholder="Optional"
              value={form.merchantName}
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Date
              <Input
                className="mt-2 h-11 bg-card px-3.5"
                onChange={(event) => updateField("expenseDate", event.target.value)}
                required
                type="date"
                value={form.expenseDate}
              />
            </label>
            <label className="block text-sm font-medium">
              Category
              <select
                className={`${fieldClassName} mt-2`}
                onChange={(event) => updateField("categoryId", event.target.value)}
                value={form.categoryId}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Note
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-card px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Optional"
              value={form.description}
            />
          </label>
        </form>
        <DialogFooter className="-mx-6 -mb-6 mt-2 p-6">
          <Button disabled={mutation.isPending} form="expense-form" size="lg" type="submit">
            {mutation.isPending ? "Saving…" : expense ? "Save changes" : "Add expense"}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => onOpenChange(false)} size="lg" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
