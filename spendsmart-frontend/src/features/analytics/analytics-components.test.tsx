import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { server } from "@/test/test-server";

import { BudgetStatusPanel } from "./budget-status-panel";
import { CategoryBreakdownChart } from "./category-breakdown-chart";
import { SpendingTrendChart } from "./spending-trend-chart";

vi.mock("@/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: 3, email: "test@example.com", full_name: "Test User" },
    isAuthenticated: true,
    status: "authenticated",
  }),
}));

const apiBase = "http://localhost:8000";
const period = { month: 7, year: 2026 };

function TestProviders({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function summaryResponse() {
  return {
    month: 7,
    year: 2026,
    currency: "INR",
    total_spent: "2550.50",
    expense_count: 3,
    by_category: [
      {
        category_id: 1,
        category_name: "Food & Dining",
        category_icon: "utensils",
        amount: "1900.50",
        expense_count: 2,
      },
      {
        category_id: 5,
        category_name: "Entertainment",
        category_icon: "movie",
        amount: "650.00",
        expense_count: 1,
      },
    ],
  };
}

describe("analytics panels", () => {
  it("renders populated category data and its accessible table", async () => {
    server.use(http.get(`${apiBase}/analytics/summary`, () => HttpResponse.json(summaryResponse())));

    render(<CategoryBreakdownChart period={period} />, { wrapper: TestProviders });

    expect(await screen.findByText("₹2,550.50")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Confirmed spending by category for July 2026" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "Food & Dining ₹1,900.50 2" })).toBeInTheDocument();
  });

  it("renders category loading and empty states", async () => {
    server.use(http.get(`${apiBase}/analytics/summary`, async () => {
      await delay("infinite");
      return HttpResponse.json(summaryResponse());
    }));
    const loadingView = render(<CategoryBreakdownChart period={period} />, { wrapper: TestProviders });
    expect(screen.getByRole("status", { name: "Loading analytics" })).toBeInTheDocument();
    loadingView.unmount();

    server.use(http.get(`${apiBase}/analytics/summary`, () => HttpResponse.json({ ...summaryResponse(), total_spent: "0.00", expense_count: 0, by_category: [] })));
    render(<CategoryBreakdownChart period={period} />, { wrapper: TestProviders });
    expect(await screen.findByText("No confirmed expenses yet for July 2026.")).toBeInTheDocument();
  });

  it("renders an error and successfully retries", async () => {
    let attempts = 0;
    server.use(http.get(`${apiBase}/analytics/summary`, () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ detail: "Unavailable" }, { status: 500 })
        : HttpResponse.json(summaryResponse());
    }));
    const user = userEvent.setup();
    render(<CategoryBreakdownChart period={period} />, { wrapper: TestProviders });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("₹2,550.50")).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("handles zero and over-budget progress states", async () => {
    server.use(http.get(`${apiBase}/analytics/budget-status`, () => HttpResponse.json({
      month: 7,
      year: 2026,
      currency: "INR",
      overall: null,
      categories: [
        { budget_id: 1, category_id: 5, category_name: "Entertainment", category_icon: "movie", budget_amount: "0.00", actual_amount: "650.00", remaining_amount: "-650.00", percent_used: null, is_over_budget: true },
        { budget_id: 2, category_id: 1, category_name: "Food & Dining", category_icon: "utensils", budget_amount: "500.00", actual_amount: "700.50", remaining_amount: "-200.50", percent_used: "140.10", is_over_budget: true },
      ],
    })));

    render(<BudgetStatusPanel period={period} />, { wrapper: TestProviders });

    expect(await screen.findByRole("progressbar", { name: "No percentage available" })).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByRole("progressbar", { name: "140.10% used" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("₹200.50 over budget")).toBeInTheDocument();
  });

  it("renders the backend-provided dense trend and requested window", async () => {
    let requestedMonths = "";
    server.use(http.get(`${apiBase}/analytics/trend`, ({ request }) => {
      requestedMonths = new URL(request.url).searchParams.get("months") ?? "";
      return HttpResponse.json({
        currency: "INR",
        months: [
          { month: 5, year: 2026, total_spent: "0.00", expense_count: 0 },
          { month: 6, year: 2026, total_spent: "780.00", expense_count: 1 },
          { month: 7, year: 2026, total_spent: "2550.50", expense_count: 3 },
        ],
      });
    }));

    render(<SpendingTrendChart monthsBack={12} period={period} />, { wrapper: TestProviders });

    expect(await screen.findByRole("row", { name: "May 2026 ₹0.00 0" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "Jul 2026 ₹2,550.50 3" })).toBeInTheDocument();
    expect(requestedMonths).toBe("12");
  });
});
