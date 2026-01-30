"use client";

import { useEffect, useRef, useState } from "react";
import { marketingCopy } from "@trail/content";
import { cn } from "@trail/ui";

const SITE_MESSAGE_SOURCE = "trail-site";
const EXTENSION_MESSAGE_SOURCE = "trail-extension";
const OPEN_TRAIL_PANEL = "OPEN_TRAIL_PANEL";
const OPEN_TRAIL_PANEL_ACK = "OPEN_TRAIL_PANEL_ACK";
const OPEN_TIMEOUT_MS = 900;

type OpenState = "idle" | "opening" | "opened" | "missing";

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function requestOpenTrailPanel(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const requestId = createRequestId();
    let finished = false;

    const finish = (value: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as
        | { source?: string; type?: string; requestId?: string; ok?: boolean }
        | null;
      if (!data || data.source !== EXTENSION_MESSAGE_SOURCE) return;
      if (data.type !== OPEN_TRAIL_PANEL_ACK) return;
      if (data.requestId !== requestId) return;
      finish(Boolean(data.ok));
    };

    const timeoutId = window.setTimeout(() => finish(false), OPEN_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: SITE_MESSAGE_SOURCE, type: OPEN_TRAIL_PANEL, requestId },
      window.location.origin
    );
  });
}

export function OpenExtensionButton({ className }: { className?: string }) {
  const { cta } = marketingCopy;
  const [state, setState] = useState<OpenState>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleClick = async () => {
    if (state === "opening") return;
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setState("opening");
    const opened = await requestOpenTrailPanel();
    if (opened) {
      setState("opened");
      resetTimerRef.current = window.setTimeout(() => setState("idle"), 1400);
      return;
    }
    setState("missing");
  };

  const label = state === "opening" ? cta.openExtensionLoading : cta.openExtension;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "opening"}
        aria-busy={state === "opening"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke",
          className
        )}
      >
        {label}
      </button>
      {state === "missing" ? (
        <span className="text-xs text-ink-subtle">
          {cta.openExtensionNotFound}{" "}
          <a
            href="/downloads"
            className="font-semibold text-ink underline decoration-dashed underline-offset-4 hover:text-ink"
          >
            {cta.openExtensionInstallCta}
          </a>
        </span>
      ) : null}
    </div>
  );
}
