import { useCallback, useRef, useState } from "react";
import { cn } from "../../../../ui/lib/utils.js";
import { navigate, type RouteParams } from "../router.js";
import { useImportTrail } from "../hooks/useImportTrail.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "@shared/types/export.js";
import { isNavigationTreeJSON } from "@shared/types/tree.js";
import { Button } from "@ui/components/ui/button";
import { Badge } from "@ui/components/ui/badge";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { Card, CardContent } from "@ui/components/ui/card";
import { ChevronLeft, Upload, Loader2 } from "lucide-react";

function isTrailExportBundle(value: unknown): value is TrailExportBundle {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.schema !== EXPORT_SCHEMA) return false;
  if (typeof obj.exportedAt !== "number") return false;
  if (!obj.source || typeof obj.source !== "object") return false;
  const source = obj.source as Record<string, unknown>;
  if (typeof source.origin !== "string") return false;
  if (!obj.tree || typeof obj.tree !== "object") return false;
  if (!isNavigationTreeJSON(obj.tree)) return false;
  if (!obj.meta || typeof obj.meta !== "object") return false;
  const meta = obj.meta as Record<string, unknown>;
  if (typeof meta.nodeCount !== "number") return false;
  return true;
}

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

      if (!isTrailExportBundle(parsed)) {
        const schemaHint = parsed.schema === EXPORT_SCHEMA
          ? "missing or invalid tree, source, or meta fields"
          : `expected schema "${EXPORT_SCHEMA}", got "${String(parsed.schema ?? "none")}"`;
        setState({
          step: "error",
          message: `Invalid trail file: ${schemaHint}.`,
        });
        return;
      }

      const bundle = parsed as TrailExportBundle;
      const rootData = (bundle.tree.root?.data as Record<string, unknown>) ?? null;

      const preview: PreviewData = {
        label:
          bundle.source.treeLabel ||
          (typeof rootData?.title === "string" && rootData.title) ||
          "Unnamed Trail",
        nodeCount: bundle.meta.nodeCount,
        rootUrl: typeof rootData?.url === "string" ? rootData.url : null,
        rootTitle: typeof rootData?.title === "string" ? rootData.title : null,
        exportedAt: new Date(bundle.exportedAt).toLocaleString(),
        origin: bundle.source.origin,
      };

      setState({
        step: "preview",
        bundle,
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
    <div className="flex flex-col gap-5 max-w-3xl">
      <Button variant="ghost" size="sm" className="text-[13px] text-muted-foreground hover:text-foreground -ml-2 h-auto px-2 py-1" asChild>
        <a href="#/trails">
          <ChevronLeft className="size-4" />
          back to trails
        </a>
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight m-0">Import trail</h1>
        <p className="text-[13px] text-muted-foreground m-0">
          Upload a <code className="px-1 py-px rounded bg-muted text-xs">.trail.json</code> file to import it
          locally.
        </p>
      </div>

      {(state.step === "idle" || state.step === "error") && (
        <>
          <div
            className={cn(
              "flex flex-col items-center gap-3 py-12 px-6 border-2 border-dashed rounded-lg bg-card text-center transition-colors",
              dragOver && "border-foreground/40 bg-muted/50",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-[13px] text-muted-foreground m-0">drag &amp; drop a file here, or</p>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>choose file</span>
              </Button>
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
            <Alert variant="destructive" className="border-destructive">
              <AlertDescription className="text-[13px]">{state.message}</AlertDescription>
            </Alert>
          )}
        </>
      )}

      {state.step === "preview" && (
        <div className="flex flex-col gap-4">
          <Card className="gap-3 rounded-lg py-4">
            <CardContent className="px-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-medium text-foreground truncate m-0">{state.preview.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 m-0">from {state.fileName}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[11px] tabular-nums">
                {state.preview.nodeCount} node
                {state.preview.nodeCount === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[13px]">
              {state.preview.rootUrl && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Root URL</span>
                  <p className="mt-0.5 truncate m-0">{state.preview.rootUrl}</p>
                </div>
              )}
              {state.preview.rootTitle && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Root title</span>
                  <p className="mt-0.5 truncate m-0">{state.preview.rootTitle}</p>
                </div>
              )}
              {state.preview.exportedAt && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Exported</span>
                  <p className="mt-0.5 truncate m-0">{state.preview.exportedAt}</p>
                </div>
              )}
              {state.preview.origin && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Origin</span>
                  <p className="mt-0.5 truncate m-0">{state.preview.origin}</p>
                </div>
              )}
            </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleImport()}>Import</Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {state.step === "importing" && (
        <Card className="flex-row items-center gap-3 rounded-lg py-4 px-4 text-[13px]">
          <Loader2 className="size-4 animate-spin" />
          <span>Importing trail...</span>
        </Card>
      )}

      {state.step === "done" && (
        <div className="flex flex-col gap-4">
          <Alert className="border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400">
            <AlertDescription className="text-[13px]">Trail imported successfully!</AlertDescription>
          </Alert>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate(`/trails/${state.treeId}`)}>View trail</Button>
            <Button variant="outline" onClick={reset}>Import another</Button>
          </div>
        </div>
      )}
    </div>
  );
}
