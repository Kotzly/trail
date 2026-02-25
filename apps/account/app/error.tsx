"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            an unexpected error occurred. please try again.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            try again
          </button>
          <Link
            href="/trails"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            go to trails
          </Link>
        </div>
      </div>
    </div>
  );
}
