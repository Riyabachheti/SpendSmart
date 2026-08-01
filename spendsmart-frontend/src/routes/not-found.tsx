import { Link } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";

export function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-medium tracking-wide text-berry">404</p>
      <h1 className="text-4xl leading-tight sm:text-5xl">That page has wandered off.</h1>
      <p className="mt-5 text-muted-foreground">
        Check the address or return to a familiar part of SpendSmart.
      </p>
      <Link
        className="mt-8 w-fit font-medium text-moss hover:text-foreground"
        to={isAuthenticated ? "/dashboard" : "/"}
      >
        {isAuthenticated ? "Return to overview" : "Return home"}
      </Link>
    </main>
  );
}
