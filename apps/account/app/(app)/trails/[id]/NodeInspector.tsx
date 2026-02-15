"use client";

import { useCallback, useEffect, useState } from "react";
import { onExtensionEvent } from "@/src/lib/trail-extension";

type NodeData = {
  id: string;
  url?: string;
  title?: string;
  favicon?: string;
  tags?: string[];
  children?: number;
  depth?: number;
  timestamp?: number;
};

export default function NodeInspector() {
  const [node, setNode] = useState<NodeData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return onExtensionEvent((event) => {
      if (event.type === "NODE_SELECTED" && event.nodeData) {
        const data = event.nodeData as Record<string, unknown>;
        setNode({
          id: event.nodeId,
          url: typeof data.url === "string" ? data.url : undefined,
          title: typeof data.title === "string" ? data.title : undefined,
          favicon: typeof data.favicon === "string" ? data.favicon : undefined,
          tags: Array.isArray(data.tags) ? data.tags as string[] : undefined,
          children: typeof data.childCount === "number" ? data.childCount : undefined,
          depth: typeof data.depth === "number" ? data.depth : undefined,
          timestamp: typeof data.timestamp === "number" ? data.timestamp : undefined,
        });
        setVisible(true);
      }
      if (event.type === "EDITOR_MODE_EXITED") {
        setVisible(false);
        setNode(null);
      }
    });
  }, []);

  if (!visible || !node) return null;

  return (
    <div className="mt-6 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Node Inspector</h2>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-muted-foreground hover:text-foreground"
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
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 p-4">
        {node.favicon && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.favicon}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 rounded-sm"
            />
            <span className="truncate text-sm font-medium">
              {node.title || "Untitled"}
            </span>
          </div>
        )}

        {!node.favicon && node.title && (
          <p className="truncate text-sm font-medium">{node.title}</p>
        )}

        {node.url && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">URL</p>
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-sm text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
            >
              {node.url}
            </a>
          </div>
        )}

        {node.tags && node.tags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tags</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {node.children !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Children
              </p>
              <p className="mt-0.5 text-sm tabular-nums">{node.children}</p>
            </div>
          )}
          {node.depth !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Depth</p>
              <p className="mt-0.5 text-sm tabular-nums">{node.depth}</p>
            </div>
          )}
          {node.timestamp !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Visited
              </p>
              <p className="mt-0.5 text-sm">
                {new Date(node.timestamp).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
