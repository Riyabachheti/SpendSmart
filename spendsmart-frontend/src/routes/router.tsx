import { createBrowserRouter } from "react-router-dom";

import App from "@/App";
import { AppLayout } from "./app-layout";
import { NotFound } from "./not-found";
import { PublicLayout } from "./public-layout";
import { PublicOnly } from "./public-only";
import { RequireAuth } from "./require-auth";
import { RouteError } from "./route-error";
import { SessionLoading } from "./session-loading";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <SessionLoading />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { LandingPage } = await import("@/features/landing/landing-page");
              return { Component: LandingPage };
            },
          },
          {
            element: <PublicOnly />,
            children: [
              {
                path: "login",
                lazy: async () => {
                  const { LoginPage } = await import("@/features/auth/login-page");
                  return { Component: LoginPage };
                },
              },
              {
                path: "register",
                lazy: async () => {
                  const { RegisterPage } = await import("@/features/auth/register-page");
                  return { Component: RegisterPage };
                },
              },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "dashboard",
                lazy: async () => {
                  const { DashboardPage } = await import(
                    "@/features/dashboard/dashboard-page"
                  );
                  return { Component: DashboardPage };
                },
              },
              {
                path: "expenses",
                lazy: async () => {
                  const { ExpensesPage } = await import(
                    "@/features/expenses/expenses-page"
                  );
                  return { Component: ExpensesPage };
                },
              },
              {
                path: "expenses/receipts/:expenseId",
                lazy: async () => {
                  const { ReceiptReviewPage } = await import(
                    "@/features/expenses/receipt-review-page"
                  );
                  return { Component: ReceiptReviewPage };
                },
              },
              {
                path: "budgets",
                lazy: async () => {
                  const { BudgetsPage } = await import(
                    "@/features/budgets/budgets-page"
                  );
                  return { Component: BudgetsPage };
                },
              },
              {
                path: "settings",
                lazy: async () => {
                  const { SettingsPage } = await import(
                    "@/features/settings/settings-page"
                  );
                  return { Component: SettingsPage };
                },
              },
            ],
          },
        ],
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
