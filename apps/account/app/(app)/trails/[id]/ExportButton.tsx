"use client";

import { useCallback } from "react";

type ExportButtonProps = {
  trailId: string;
  label: string;
  nodeCount: number;
  payload: unknown;
};

type TrailExportBundle = {
  schema: "trail.export.v1";
  exportedAt: number;
  source: {
    treeId: string;
    treeLabel: string;
    origin: "dashboard";
  };
  tree: unknown;
  meta: {
    nodeCount: number;
  };
};

export default function ExportButton({
  trailId,
  label,
  nodeCount,
  payload,
}: ExportButtonProps) {
  const handleExport = useCallback(() => {
    const bundle: TrailExportBundle = {
      schema: "trail.export.v1",
      exportedAt: Date.now(),
      source: {
        treeId: trailId,
        treeLabel: label,
        origin: "dashboard",
      },
      tree: payload,
      meta: {
        nodeCount,
      },
    };

    const json = JSON.stringify(bundle);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(label)}.trail.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [trailId, label, nodeCount, payload]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
    >
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export JSON
    </button>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "trail";
}
