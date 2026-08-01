import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ImagePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-error";

import { uploadReceipt } from "./expense-api";
import { expenseQueryKeys } from "./expense-query-keys";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ReceiptUploadError = {
  detail?: {
    expense_id?: number;
  };
};

type ReceiptUploadDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  userId: number;
};

export function ReceiptUploadDialog({
  onOpenChange,
  open,
  userId,
}: ReceiptUploadDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    if (open) {
      setFile(null);
      setErrorMessage(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: uploadReceipt,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(userId) });
      onOpenChange(false);
      navigate(`/expenses/receipts/${result.expense_id}`);
    },
    onError: (error) => {
      const failedExpenseId = axios.isAxiosError<ReceiptUploadError>(error)
        ? error.response?.data?.detail?.expense_id
        : undefined;

      if (
        typeof failedExpenseId === "number" &&
        Number.isInteger(failedExpenseId) &&
        failedExpenseId > 0
      ) {
        void queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(userId) });
        onOpenChange(false);
        navigate(`/expenses/receipts/${failedExpenseId}`);
        return;
      }

      setErrorMessage(
        getApiErrorMessage(error, "The receipt couldn’t be uploaded. Please try again."),
      );
    },
  });

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setErrorMessage(null);

    if (nextFile && !acceptedTypes.has(nextFile.type)) {
      setFile(null);
      setErrorMessage("Choose a JPEG, PNG, or WebP receipt image.");
      event.target.value = "";
      return;
    }

    setFile(nextFile);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setErrorMessage("Choose a receipt image first.");
      return;
    }
    mutation.mutate(file);
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Begin with a receipt</DialogTitle>
          <DialogDescription>
            Upload a clear photo. SpendSmart will read it, then ask you to review every detail.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-2" id="receipt-upload-form" onSubmit={handleSubmit}>
          {errorMessage ? (
            <p className="mb-5 border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/30 px-6 py-8 text-center hover:bg-muted/60">
            {previewUrl ? (
              <img
                alt="Selected receipt preview"
                className="mb-4 max-h-48 rounded-lg object-contain"
                src={previewUrl}
              />
            ) : (
              <ImagePlus aria-hidden="true" className="mb-4 size-7 text-berry" />
            )}
            <span className="font-medium">{file ? file.name : "Choose a receipt image"}</span>
            <span className="mt-2 text-xs leading-5 text-muted-foreground">JPEG, PNG, or WebP</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={mutation.isPending}
              onChange={selectFile}
              type="file"
            />
          </label>
        </form>
        <DialogFooter className="-mx-6 -mb-6 mt-2 p-6">
          <Button disabled={!file || mutation.isPending} form="receipt-upload-form" size="lg" type="submit">
            {mutation.isPending ? "Uploading…" : "Upload receipt"}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => onOpenChange(false)} size="lg" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
