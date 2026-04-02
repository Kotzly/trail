"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function TrailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Failed to load trails</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching your trails.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
