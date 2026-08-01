import type { ReactNode } from "react";

export function AnalyticsPanelSkeleton({ variant = "rows" }: { variant?: "chart" | "rows" }) {
  return (
    <div aria-label="Loading analytics" className="animate-pulse py-5" role="status">
      {variant === "chart" ? (
        <div className="h-64 rounded-lg bg-muted" />
      ) : (
        <div className="space-y-5">
          {[0, 1, 2].map((row) => (
            <div key={row}>
              <div className="mb-3 h-4 w-2/3 rounded bg-muted" />
              <div className="h-2 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function AnalyticsPanelError({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry: () => void;
}) {
  return (
    <div className="py-8">
      <p className="text-sm text-destructive" role="alert">{children}</p>
      <button
        className="mt-3 cursor-pointer text-sm font-medium text-moss hover:text-foreground"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
