"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type OnboardingStatus = "pending" | "completed";

type OnboardingState = {
  flowId: string;
  status: OnboardingStatus;
  seenAt: string | null;
};

type Props = {
  initialStatus: OnboardingStatus;
};

const POLL_INTERVAL_MS = 2500;

export default function OnboardingGate({ initialStatus }: Props) {
  const [status, setStatus] = useState<OnboardingStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus("completed");
    stopPolling();
  }, [stopPolling]);

  // Poll for external completion (e.g. user completed in extension)
  useEffect(() => {
    if (status !== "pending") return;

    const poll = async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { onboarding?: OnboardingState };
        if (data.onboarding?.status === "completed") {
          dismiss();
        }
      } catch {
        // Silently ignore poll errors
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return stopPolling;
  }, [status, dismiss, stopPolling]);

  const handleComplete = useCallback(
    async (action: "complete" | "skip") => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, source: "web" }),
        });
        if (!res.ok) {
          throw new Error("Request failed");
        }
        dismiss();
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [dismiss],
  );

  if (status === "completed") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Welcome to Trail
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Trail maps your browsing into a visual tree so you never lose
            context. Install the extension and start exploring.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3">
            <Button
              onClick={() => void handleComplete("complete")}
              disabled={busy}
              className="w-full"
            >
              {busy ? "Saving…" : "Get started"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleComplete("skip")}
              disabled={busy}
              className="w-full"
            >
              Skip for now
            </Button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
