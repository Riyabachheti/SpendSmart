import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", to: "/dashboard" },
  { label: "Expenses", to: "/expenses" },
  { label: "Budgets", to: "/budgets" },
];

export function AppLayout() {
  const { logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = user?.full_name?.trim() || user?.email;

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      // The provider always clears local credentials, even if revocation fails.
    }
  }

  return (
    <div className="min-h-svh">
      <a
        className="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
          <Link className="mr-auto font-serif text-xl font-semibold tracking-tight" to="/dashboard">
            SpendSmart
          </Link>
          <nav aria-label="Primary" className="order-3 flex w-full gap-6 text-sm sm:order-none sm:w-auto">
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "border-b-2 border-transparent py-1 text-muted-foreground transition-colors hover:text-foreground",
                    isActive && "border-marigold text-foreground",
                  )
                }
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <ThemeToggle />
            <Link className="max-w-44 truncate text-muted-foreground hover:text-foreground" to="/settings">
              {displayName}
            </Link>
            <button
              className="cursor-pointer text-muted-foreground hover:text-foreground disabled:cursor-wait disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
              type="button"
            >
              {isLoggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </div>
    </div>
  );
}
