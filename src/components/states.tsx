import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Grey placeholder blocks while data loads. */
export function Loading({ rows = 3, className = "h-24" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`animate-pulse rounded-2xl bg-secondary ${className}`} />
      ))}
    </div>
  );
}

/** Shown when a query fails. */
export function QueryError({ onRetry }: { onRetry?: (() => void) | undefined }) {
  return (
    <div role="alert" className="tile space-y-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">Could not load this. Check your connection.</p>
      {onRetry && (
        <Button variant="outline" className="h-11" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Shown when there is nothing to list yet. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}
