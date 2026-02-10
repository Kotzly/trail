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

  // Listen for EDITOR_MODE_EXITED to update status
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

  const handleRetry = () => {
    checkExtension();
  };

  return (
    <div className="flex flex-col gap-2">
      {status === "checking" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SpinnerIcon />
          Checking extension...
        </div>
      )}

      {status === "not-found" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Extension not detected.{" "}
            <a
              href="https://gettrail.net"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Install Trail extension
            </a>{" "}
            to edit.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {status === "not-authenticated" && (
        <p className="text-sm text-muted-foreground">
          Sign in to the extension first to enable editing.
        </p>
      )}

      {status === "ready" && (
        <button
          type="button"
          onClick={handleEdit}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PencilIcon />
          Edit in Extension
        </button>
      )}

      {status === "entering" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SpinnerIcon />
          Opening editor...
        </div>
      )}

      {status === "editing" && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-4 py-2 text-sm text-green-600 dark:text-green-400">
          <CheckIcon />
          Editing in extension
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-red-500">
            {errorMsg ?? "Failed to enter editor mode."}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
