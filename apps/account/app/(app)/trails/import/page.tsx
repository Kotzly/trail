"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EXPORT_SCHEMA = "trail.export.v1";

type PreviewData = {
  label: string;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  exportedAt: string | null;
  origin: string | null;
};

type ImportState =
  | { step: "idle" }
  | { step: "preview"; bundle: unknown; preview: PreviewData; fileName: string }
  | { step: "importing" }
  | { step: "done"; trailId: string }
  | { step: "error"; message: string };

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<ImportState>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;

      if (parsed.schema !== EXPORT_SCHEMA) {
        setState({
          step: "error",
          message: `Invalid file: expected schema "${EXPORT_SCHEMA}", got "${String(parsed.schema ?? "none")}".`,
        });
        return;
      }

      const tree = parsed.tree as Record<string, unknown> | undefined;
      if (!tree || typeof tree !== "object" || !("root" in tree)) {
        setState({ step: "error", message: "Invalid file: missing or invalid tree data." });
        return;
      }

      const source = (parsed.source ?? {}) as Record<string, unknown>;
      const meta = (parsed.meta ?? {}) as Record<string, unknown>;
      const rootNode = tree.root as Record<string, unknown> | null;
      const rootData = (rootNode?.data as Record<string, unknown>) ?? null;

      const preview: PreviewData = {
        label:
          (typeof source.treeLabel === "string" && source.treeLabel) ||
          (typeof rootData?.title === "string" && rootData.title) ||
          "Unnamed Trail",
        nodeCount: typeof meta.nodeCount === "number" ? meta.nodeCount : (typeof tree.nodeCount === "number" ? (tree.nodeCount as number) : 0),
        rootUrl: typeof rootData?.url === "string" ? rootData.url : null,
        rootTitle: typeof rootData?.title === "string" ? rootData.title : null,
        exportedAt:
          typeof parsed.exportedAt === "number"
            ? new Date(parsed.exportedAt as number).toLocaleString()
            : null,
        origin: typeof source.origin === "string" ? source.origin : null,
      };

      setState({ step: "preview", bundle: parsed, preview, fileName: file.name });
    } catch (err) {
      setState({
        step: "error",
        message: err instanceof SyntaxError ? "Invalid JSON file." : "Failed to read file.",
      });
    }
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const handleImport = useCallback(async () => {
    if (state.step !== "preview") return;
    setState({ step: "importing" });

    try {
      const res = await fetch("/api/v1/trails/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.bundle),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setState({
          step: "error",
          message: err?.message ?? `Import failed (${res.status}).`,
        });
        return;
      }

      const data = (await res.json()) as { id: string };
      setState({ step: "done", trailId: data.id });
    } catch {
      setState({ step: "error", message: "Network error during import." });
    }
  }, [state]);

  const reset = useCallback(() => {
    setState({ step: "idle" });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <section className="space-y-6">
      <Link
        href="/trails"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        back to trails
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">import trail</h1>
        <p className="text-sm text-muted-foreground">
          Upload a <code className="rounded bg-muted px-1 py-0.5 text-xs">.trail.json</code> file to import it into your account.
        </p>
      </div>

      {/* Drop zone */}
      {(state.step === "idle" || state.step === "error") && (
        <>
          <div
            className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragOver
                ? "border-foreground/40 bg-muted/50"
                : "border-border bg-card"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm text-muted-foreground">
              drag &amp; drop a file here, or
            </p>
            <label className="cursor-pointer rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50">
              choose file
              <input
                ref={fileRef}
                type="file"
                accept=".json,.trail.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {state.step === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {state.message}
            </div>
          )}
        </>
      )}

      {/* Preview */}
      {state.step === "preview" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-medium">{state.preview.label}</h2>
                <p className="text-xs text-muted-foreground">
                  from {state.fileName}
                </p>
              </div>
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {state.preview.nodeCount} node{state.preview.nodeCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {state.preview.rootUrl && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Root URL</span>
                  <p className="truncate">{state.preview.rootUrl}</p>
                </div>
              )}
              {state.preview.rootTitle && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Root title</span>
                  <p className="truncate">{state.preview.rootTitle}</p>
                </div>
              )}
              {state.preview.exportedAt && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Exported</span>
                  <p>{state.preview.exportedAt}</p>
                </div>
              )}
              {state.preview.origin && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Origin</span>
                  <p>{state.preview.origin}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Import
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {state.step === "importing" && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-6">
          <svg
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm">Importing trail…</span>
        </div>
      )}

      {/* Done */}
      {state.step === "done" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Trail imported successfully!
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/trails/${state.trailId}`)}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              View trail
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
