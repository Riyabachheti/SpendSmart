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

import { createCategory, updateCategory } from "../categories/category-api";
import { categoryQueryKeys } from "../categories/category-query-keys";
import type { Category } from "../categories/category-types";

type CategoryFormDialogProps = {
  category: Category | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  userId: number;
};

export function CategoryFormDialog({
  category,
  onOpenChange,
  open,
  userId,
}: CategoryFormDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setIcon(category?.icon ?? "");
      setErrorMessage(null);
    }
  }, [category, open]);

  const mutation = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), icon: icon.trim() || null };
      return category
        ? updateCategory(category.id, input)
        : createCategory(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all(userId) });
      onOpenChange(false);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, `The category couldn’t be ${category ? "updated" : "created"}.`),
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage("Enter a category name.");
      return;
    }
    mutation.mutate();
  }

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
            {category ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            Give recurring spending a name that feels natural to you.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-5" id="category-form" onSubmit={handleSubmit}>
          {errorMessage ? (
            <p className="border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <label className="block text-sm font-medium">
            Name
            <Input
              autoFocus
              className="mt-2 h-11 bg-card px-3.5"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="block text-sm font-medium">
            Icon or emoji
            <Input
              className="mt-2 h-11 bg-card px-3.5"
              maxLength={50}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="Optional"
              value={icon}
            />
          </label>
        </form>
        <DialogFooter className="-mx-6 -mb-6 mt-2 p-6">
          <Button disabled={mutation.isPending} form="category-form" size="lg" type="submit">
            {mutation.isPending ? "Saving…" : category ? "Save changes" : "Create category"}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => onOpenChange(false)} size="lg" variant="outline">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
