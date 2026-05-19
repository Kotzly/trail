import type { SharedTrailNode } from "@/lib/shared-trail-types";

/**
 * Read-only hierarchical render of a shared trail. v1 keeps it simple —
 * a nested list — rather than extracting the extension's interactive
 * xyflow graph. Once the public viewer has shipped and proved stable
 * the graph extraction can move into `packages/ui` or its own package.
 */
export function SharedTrailTree({ root }: { root: SharedTrailNode }) {
  return (
    <ol className="space-y-1 text-sm">
      <SharedTrailNodeRow node={root} depth={0} />
    </ol>
  );
}

function SharedTrailNodeRow({
  node,
  depth,
}: {
  node: SharedTrailNode;
  depth: number;
}) {
  const title = node.data.title || node.data.url || "Untitled";
  const host = safeHost(node.data.url);
  return (
    <>
      <li
        className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span
          className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <a
            href={node.data.url || "#"}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="line-clamp-2 break-words font-medium hover:underline"
          >
            {title}
          </a>
          {host ? (
            <p className="truncate text-xs text-muted-foreground">{host}</p>
          ) : null}
        </div>
      </li>
      {node.children.length > 0 ? (
        <ol className="space-y-1">
          {node.children.map((child) => (
            <SharedTrailNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ol>
      ) : null}
    </>
  );
}

function safeHost(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
