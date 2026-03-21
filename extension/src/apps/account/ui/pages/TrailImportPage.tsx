import { useCallback, useRef, useState } from "react";
import { cn } from "../../../../ui/lib/utils.js";
import { navigate, type RouteParams } from "../router.js";
import { useImportTrail } from "../hooks/useImportTrail.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "@shared/types/export.js";

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
  | { step: "preview"; bundle: TrailExportBundle; preview: PreviewData; fileName: string }
  | { step: "importing" }
  | { step: "done"; treeId: string }
  | { step: "error"; message: string };

export default function TrailImportPage(_props: RouteParams) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<ImportState>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const { importTrail } = useImportTrail();

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
        setState({
          step: "error",
          message: "Invalid file: missing or invalid tree data.",
        });
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
        nodeCount:
          typeof meta.nodeCount === "number"
            ? meta.nodeCount
            : typeof tree.nodeCount === "number"
              ? (tree.nodeCount as number)
              : 0,
        rootUrl: typeof rootData?.url === "string" ? rootData.url : null,
        rootTitle: typeof rootData?.title === "string" ? rootData.title : null,
        exportedAt:
          typeof parsed.exportedAt === "number"
            ? new Date(parsed.exportedAt as number).toLocaleString()
            : null,
        origin: typeof source.origin === "string" ? source.origin : null,
      };

      setState({
        step: "preview",
        bundle: parsed as unknown as TrailExportBundle,
        preview,
        fileName: file.name,
      });
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
      const treeId = await importTrail(state.bundle);
      setState({ step: "done", treeId });
    } catch {
      setState({ step: "error", message: "Import failed. Please try again." });
    }
  }, [state, importTrail]);

  const reset = useCallback(() => {
    setState({ step: "idle" });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className="account-page">
      <a href="#/trails" className="account-back-link">
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
      </a>

      <div className="import-heading">
        <h1 className="account-page__title">Import trail</h1>
        <p className="import-heading__subtitle">
          Upload a <code className="import-heading__code">.trail.json</code> file to import it
          locally.
        </p>
      </div>

      {(state.step === "idle" || state.step === "error") && (
        <>
          <div
            className={cn("import-dropzone", dragOver && "import-dropzone--active")}
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
              className="import-dropzone__icon"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="import-dropzone__text">drag &amp; drop a file here, or</p>
            <label className="account-btn account-btn--secondary import-dropzone__label">
              choose file
              <input
                ref={fileRef}
                type="file"
                accept=".json,.trail.json"
                className="import-dropzone__input"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {state.step === "error" && <div className="import-error">{state.message}</div>}
        </>
      )}

      {state.step === "preview" && (
        <div className="import-preview">
          <div className="import-preview__card">
            <div className="import-preview__header">
              <div className="import-preview__identity">
                <h2 className="import-preview__label">{state.preview.label}</h2>
                <p className="import-preview__filename">from {state.fileName}</p>
              </div>
              <span className="trail-card__badge">
                {state.preview.nodeCount} node
                {state.preview.nodeCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="import-preview__meta">
              {state.preview.rootUrl && (
                <div>
                  <span className="import-preview__meta-label">Root URL</span>
                  <p className="import-preview__meta-value">{state.preview.rootUrl}</p>
                </div>
              )}
              {state.preview.rootTitle && (
                <div>
                  <span className="import-preview__meta-label">Root title</span>
                  <p className="import-preview__meta-value">{state.preview.rootTitle}</p>
                </div>
              )}
              {state.preview.exportedAt && (
                <div>
                  <span className="import-preview__meta-label">Exported</span>
                  <p className="import-preview__meta-value">{state.preview.exportedAt}</p>
                </div>
              )}
              {state.preview.origin && (
                <div>
                  <span className="import-preview__meta-label">Origin</span>
                  <p className="import-preview__meta-value">{state.preview.origin}</p>
                </div>
              )}
            </div>
          </div>

          <div className="import-preview__actions">
            <button
              type="button"
              className="account-btn account-btn--primary"
              onClick={() => void handleImport()}
            >
              Import
            </button>
            <button type="button" className="account-btn account-btn--secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.step === "importing" && (
        <div className="import-status">
          <svg
            className="account-spinner"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Importing trail...</span>
        </div>
      )}

      {state.step === "done" && (
        <div className="import-done">
          <div className="import-done__message">Trail imported successfully!</div>
          <div className="import-done__actions">
            <button
              type="button"
              className="account-btn account-btn--primary"
              onClick={() => navigate(`/trails/${state.treeId}`)}
            >
              View trail
            </button>
            <button type="button" className="account-btn account-btn--secondary" onClick={reset}>
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
