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
import { createBudget, updateBudget } from "./budget-api";
import { budgetQueryKeys } from "./budget-query-keys";
import type { Budget } from "./budget-types";

type BudgetFormDialogProps = {
  budget: Budget | null;
  budgets: Budget[];
  categories: Category[];
  month: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  periodLabel: string;
  userId: number;
  year: number;
};

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function BudgetFormDialog({
  budget,
  budgets,
  categories,
  month,
  onOpenChange,
  open,
  periodLabel,
  userId,
  year,
}: BudgetFormDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(budget?.amount ?? "");
      setCategoryId("");
      setErrorMessage(null);
    }
  }, [budget, open]);

  const mutation = useMutation({
    mutationFn: () =>
      budget
        ? updateBudget(budget.id, amount)
        : createBudget({
            amount,
            category_id: categoryId ? Number(categoryId) : null,
            month,
            year,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all(userId) });
      onOpenChange(false);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, `The budget couldn’t be ${budget ? "updated" : "created"}.`),
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setErrorMessage("Enter a budget amount greater than zero.");
      return;
    }
    if (!budget && categoryId === "" && hasOverallBudget) {
      setErrorMessage("Choose a category. An overall budget already exists for this month.");
      return;
    }
    if (!budget && categoryId && usedCategoryIds.has(Number(categoryId))) {
      setErrorMessage("A budget already exists for that category this month.");
      return;
    }
    mutation.mutate();
  }

  const usedCategoryIds = new Set(
    budgets
      .map((existingBudget) => existingBudget.category_id)
      .filter((id): id is number => id !== null),
  );
  const hasOverallBudget = budgets.some((existingBudget) => existingBudget.category_id === null);
  const budgetScope = budget?.category_id === null
    ? "Overall monthly budget"
    : categories.find((category) => category.id === budget?.category_id)?.name ?? "Category budget";

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {budget ? "Edit budget" : "Add a budget"}
          </DialogTitle>
          <DialogDescription>
            {budget ? `${budgetScope} for ${periodLabel}.` : `Set a boundary for ${periodLabel}. Budgets use INR.`}
          </DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-5" id="budget-form" onSubmit={handleSubmit}>
          {errorMessage ? (
            <p className="border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {!budget ? (
            <label className="block text-sm font-medium">
              Budget for
              <select
                className={`${selectClassName} mt-2`}
                onChange={(event) => setCategoryId(event.target.value)}
                value={categoryId}
              >
                <option disabled={hasOverallBudget} value="">
                  Overall monthly budget{hasOverallBudget ? " — already set" : ""}
                </option>
                {categories.map((category) => (
                  <option
                    disabled={usedCategoryIds.has(category.id)}
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                    {usedCategoryIds.has(category.id) ? " — already set" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            Amount in INR
            <Input
              autoFocus
              className="mt-2 h-11 bg-card px-3.5"
              inputMode="decimal"
              min="0.01"
              onChange={(event) => setAmount(event.target.value)}
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </label>
        </form>
        <DialogFooter className="-mx-6 -mb-6 mt-2 p-6">
          <Button disabled={mutation.isPending} form="budget-form" size="lg" type="submit">
            {mutation.isPending ? "Saving…" : budget ? "Save amount" : "Add budget"}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => onOpenChange(false)} size="lg" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
