import { Link, Outlet } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";

export function PublicLayout() {
  const { status } = useAuth();

  return (
    <div className="min-h-svh">
      <a
        className="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="border-b border-border/70">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link className="font-serif text-xl font-semibold tracking-tight" to="/">
            SpendSmart
          </Link>
          {status === "authenticated" ? (
            <Link className="text-sm font-medium text-moss hover:text-foreground" to="/dashboard">
              Open SpendSmart
            </Link>
          ) : null}
          {status === "anonymous" ? (
            <nav aria-label="Account" className="flex items-center gap-5 text-sm">
              <Link className="text-muted-foreground hover:text-foreground" to="/login">
                Log in
              </Link>
              <Link className="font-medium text-moss hover:text-foreground" to="/register">
                Create account
              </Link>
            </nav>
          ) : null}
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Outlet />
      </div>
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>SpendSmart · A calmer record of everyday money.</p>
          <p>Built for clarity, not judgment.</p>
        </div>
      </footer>
    </div>
  );
}
