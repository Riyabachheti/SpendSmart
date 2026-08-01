import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { server } from "@/test/test-server";

import { DashboardPage } from "./dashboard-page";

vi.mock("@/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: 3, email: "test@example.com", full_name: "Test User" },
    isAuthenticated: true,
    status: "authenticated",
  }),
}));

const apiBase = "http://localhost:8000";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("DashboardPage analytics controls", () => {
  it("coordinates the selected period and trend window across requests", async () => {
    const summaryPeriods: string[] = [];
    const budgetPeriods: string[] = [];
    const trendWindows: string[] = [];

    server.use(
      http.get(`${apiBase}/expenses`, () => HttpResponse.json({ items: [], total: 0, skip: 0, limit: 5, has_more: false })),
      http.get(`${apiBase}/expenses/pending-review`, () => HttpResponse.json([])),
      http.get(`${apiBase}/analytics/summary`, ({ request }) => {
        const url = new URL(request.url);
        summaryPeriods.push(`${url.searchParams.get("month")}-${url.searchParams.get("year")}`);
        return HttpResponse.json({ month: Number(url.searchParams.get("month")), year: Number(url.searchParams.get("year")), currency: "INR", total_spent: "0.00", expense_count: 0, by_category: [] });
      }),
      http.get(`${apiBase}/analytics/budget-status`, ({ request }) => {
        const url = new URL(request.url);
        budgetPeriods.push(`${url.searchParams.get("month")}-${url.searchParams.get("year")}`);
        return HttpResponse.json({ month: Number(url.searchParams.get("month")), year: Number(url.searchParams.get("year")), currency: "INR", overall: null, categories: [] });
      }),
      http.get(`${apiBase}/analytics/trend`, ({ request }) => {
        const url = new URL(request.url);
        trendWindows.push(`${url.searchParams.get("months")}:${url.searchParams.get("end_month")}-${url.searchParams.get("end_year")}`);
        return HttpResponse.json({ currency: "INR", months: [{ month: 7, year: 2026, total_spent: "0.00", expense_count: 0 }] });
      }),
    );
    const user = userEvent.setup();
    renderDashboard();

    const month = await screen.findByRole("combobox", { name: "Month" });
    await user.selectOptions(month, "7");

    await waitFor(() => {
      expect(summaryPeriods).toContain("7-2026");
      expect(budgetPeriods).toContain("7-2026");
      expect(trendWindows).toContain("6:7-2026");
    });
    expect(await screen.findByText("No confirmed expenses yet for July 2026.")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Window" }), "12");
    await waitFor(() => expect(trendWindows).toContain("12:7-2026"));
  });
});
