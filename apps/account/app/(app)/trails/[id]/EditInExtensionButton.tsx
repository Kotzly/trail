"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ping,
  enterEditorMode,
  exitEditorMode,
  onExtensionEvent,
  type SendResult,
  type PongPayload,
} from "@/src/lib/trail-extension";

type ExtensionStatus =
  | "checking"
  | "not-found"
  | "not-authenticated"
  | "ready"
  | "entering"
  | "editing"
  | "exiting"
  | "error";

export default function EditInExtensionButton({ trailId }: { trailId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<ExtensionStatus>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  // -------------------------------------------------------------------
  // Ping the extension to determine current state
  // -------------------------------------------------------------------

  const checkExtension = useCallback(async () => {
    setStatus("checking");
    setErrorMsg(null);

    const result: SendResult<PongPayload> = await ping();

    if (!result.ok) {
      setStatus("not-found");
      return;
    }

    if (!result.data.authenticated) {
      setStatus("not-authenticated");
      return;
    }

    if (result.data.editorMode) {
      setStatus("editing");
      return;
    }

    setStatus("ready");
  }, []);

  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  // -------------------------------------------------------------------
  // Listen for proactive EDITOR_MODE_EXITED events from the extension
  // -------------------------------------------------------------------

  useEffect(() => {
    return onExtensionEvent((event) => {
      if (event.type === "EDITOR_MODE_EXITED") {
        setStatus("ready");
        // Refresh server data so the page reflects changes made in the editor
        router.refresh();
      }
    });
  }, [router]);

  // -------------------------------------------------------------------
  // Re-ping on window focus / visibility change (catches SW restart)
  // -------------------------------------------------------------------

  useEffect(() => {
    if (status !== "editing") return;

    const handleFocus = async () => {
      const result = await ping();
      if (result.ok && !result.data.editorMode) {
        setStatus("ready");
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status]);

  // -------------------------------------------------------------------
  // beforeunload warning while editing
  // -------------------------------------------------------------------

  useEffect(() => {
    if (status !== "editing") return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // -------------------------------------------------------------------
  // Auto-exit on component unmount (client-side navigation away)
  // -------------------------------------------------------------------

  useEffect(() => {
    if (status !== "editing") return;

    return () => {
      // Fire-and-forget: attempt to exit editor mode when navigating away.
      // The page may already be tearing down, but this gives the extension a
      // chance to clean up.
      if (statusRef.current === "editing") {
        exitEditorMode().catch(() => {});
      }
    };
  }, [status]);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  const handleEdit = async () => {
    setStatus("entering");
    setErrorMsg(null);

    const result = await enterEditorMode(trailId);

    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error);
      return;
    }

    setStatus("editing");
  };

  const handleExit = async () => {
    setStatus("exiting");
    const result = await exitEditorMode();
    if (result.ok) {
      setStatus("ready");
      // Refresh server data so the page reflects changes made in the editor
      router.refresh();
    } else {
      // Even if the exit message failed, try to re-check real state
      await checkExtension();
    }
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  if (status === "checking") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <SpinnerIcon className="h-3 w-3" />
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <a
        href="https://gettrail.net"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Get Trail
        <ExternalIcon className="h-3 w-3 text-muted-foreground" />
      </a>
    );
  }

  if (status === "not-authenticated") {
    return (
      <span className="text-xs text-muted-foreground">
        Sign in to extension to edit
      </span>
    );
  }

  if (status === "entering") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground opacity-70"
      >
        <SpinnerIcon className="h-3.5 w-3.5" />
        Opening…
      </button>
    );
  }

  if (status === "editing" || status === "exiting") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Editing
        </span>
        <button
          type="button"
          onClick={handleExit}
          disabled={status === "exiting"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {status === "exiting" ? (
            <>
              <SpinnerIcon className="h-3.5 w-3.5" />
              Saving…
            </>
          ) : (
            <>
              <CheckIcon className="h-3.5 w-3.5" />
              Done
            </>
          )}
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-500">
          {errorMsg ?? "Failed"}
        </span>
        <button
          type="button"
          onClick={checkExtension}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  // status === "ready"
  return (
    <button
      type="button"
      onClick={handleEdit}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <PencilIcon className="h-3.5 w-3.5" />
      Edit in Extension
    </button>
  );
}

// -------------------------------------------------------------------
// Icons
// -------------------------------------------------------------------

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className ?? ""}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
