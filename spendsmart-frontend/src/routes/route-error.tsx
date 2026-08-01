import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : "Something unexpected interrupted this page.";

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-medium text-berry">Something went wrong</p>
      <h1 className="text-4xl text-balance">This page could not be opened.</h1>
      <p className="mt-4 text-muted-foreground">{message}</p>
      <Link className="mt-8 w-fit font-medium text-moss hover:text-foreground" to="/">
        Return to SpendSmart
      </Link>
    </main>
  );
}
