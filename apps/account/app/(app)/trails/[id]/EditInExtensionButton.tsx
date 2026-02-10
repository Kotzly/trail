"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ping,
  enterEditorMode,
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
  | "error";

export default function EditInExtensionButton({ trailId }: { trailId: string }) {
  const [status, setStatus] = useState<ExtensionStatus>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    return onExtensionEvent((event) => {
      if (event.type === "EDITOR_MODE_EXITED") {
        setStatus("ready");
      }
    });
  }, []);

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

  if (status === "editing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Editing
      </span>
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
