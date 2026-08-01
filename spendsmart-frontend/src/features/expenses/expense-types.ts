export type ExpenseSource = "manual" | "ocr";
export type OcrStatus = "pending" | "processing" | "completed" | "failed";

export type Expense = {
  id: number;
  user_id: number;
  category_id: number | null;
  amount: string;
  currency: string;
  merchant_name: string | null;
  expense_date: string;
  description: string | null;
  receipt_url: string | null;
  ocr_raw_text: string | null;
  source: ExpenseSource;
  is_verified: boolean;
  ocr_status: OcrStatus | null;
  created_at: string;
  updated_at: string | null;
};

export type ExpensePage = {
  items: Expense[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
};

export type ExpenseListParams = {
  category_id?: number;
  start_date?: string;
  end_date?: string;
  source?: ExpenseSource;
  skip?: number;
  limit?: number;
};

export type ExpenseWriteInput = {
  amount: string;
  currency: string;
  category_id: number | null;
  merchant_name: string | null;
  expense_date: string;
  description: string | null;
};

export type ExpenseUpdateInput = Partial<ExpenseWriteInput>;

export type ReceiptUploadResponse = {
  expense_id: number;
  ocr_status: OcrStatus;
};
