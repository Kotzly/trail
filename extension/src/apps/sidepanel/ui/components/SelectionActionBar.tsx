import { useMemo } from "react";
import { i18n } from "#i18n";
import { Button } from "@ui/components/ui/button";
import { ButtonTooltip } from "@ui/components/button-tooltip";
import { Icons } from "./Icon.js";
import { useStore } from "../state/store.js";
import { useDeleteFlow } from "../hooks/useDeleteFlow.js";
import { bulkPin, bulkUnpin, fireAndForget } from "../../api/actions.js";

/**
 * Floating "N selected" toolbar — renders only when ≥ 2 nodes are
 * graph-selected. Solves the discoverability gap where users had to
 * right-click to act on a multi-selection.
 *
 * Compact pill: counter chip + icon-only buttons with tooltips. Sits
 * above FloatingControls, below dialogs. Disappears on selection drop.
 */
export default function SelectionActionBar() {
  const selectedNodeIds = useStore((s) => s.graph.selectedNodeIds);
  const tree = useStore((s) => s.tree);
  const clearSelection = useStore((s) => s.clearSelection);
  const { request: requestDelete } = useDeleteFlow();

  const ids = useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds]);

  const allPinned = useMemo(() => {
    if (!tree || ids.length === 0) return false;
    return ids.every((id) => tree.findNodeById(id)?.data.pinned === true);
  }, [tree, ids]);

  const hasChildren = useMemo(() => {
    if (!tree || ids.length === 0) return false;
    return ids.some((id) => (tree.findNodeById(id)?.getChildren?.() ?? []).length > 0);
  }, [tree, ids]);

  if (ids.length < 2) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center px-4"
      role="region"
      aria-label={i18n.t("sidepanel.selectionBar.selected", [String(ids.length)])}
    >
      <div className="bg-popover/95 text-popover-foreground animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 pointer-events-auto inline-flex items-center gap-0.5 rounded-full border p-1 shadow-md backdrop-blur-sm duration-(--dur-fast) ease-(--ease-out)">
        <span className="text-muted-foreground px-2 text-xs font-medium tabular-nums">
          {i18n.t("sidepanel.selectionBar.selected", [String(ids.length)])}
        </span>

        <span aria-hidden className="bg-border mx-0.5 h-4 w-px" />

        <ButtonTooltip
          label={
            allPinned
              ? i18n.t("sidepanel.selectionBar.unpin")
              : i18n.t("sidepanel.selectionBar.pin")
          }
          keys={["p"]}
        >
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={
              allPinned
                ? i18n.t("sidepanel.selectionBar.unpin")
                : i18n.t("sidepanel.selectionBar.pin")
            }
            onClick={() => {
              fireAndForget(allPinned ? bulkUnpin(ids) : bulkPin(ids), "bulk pin toggle");
              clearSelection();
            }}
            className="press-feedback rounded-full"
          >
            {allPinned ? <Icons.PinOff /> : <Icons.Pin />}
          </Button>
        </ButtonTooltip>

        <ButtonTooltip label={i18n.t("sidepanel.selectionBar.delete")} keys={["delete"]}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={i18n.t("sidepanel.selectionBar.delete")}
            onClick={() =>
              void requestDelete(
                { kind: "node", nodeIds: ids, recursive: false },
                { source: "selection-bar" },
              )
            }
            className="press-feedback text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
          >
            <Icons.Trash2 />
          </Button>
        </ButtonTooltip>

        {hasChildren && (
          <ButtonTooltip
            label={i18n.t("sidepanel.selectionBar.deleteSubtree")}
            keys={["shift", "delete"]}
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={i18n.t("sidepanel.selectionBar.deleteSubtree")}
              onClick={() =>
                void requestDelete(
                  { kind: "node", nodeIds: ids, recursive: true },
                  { source: "selection-bar" },
                )
              }
              className="press-feedback text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
            >
              <Icons.ListTree />
            </Button>
          </ButtonTooltip>
        )}

        <span aria-hidden className="bg-border mx-0.5 h-4 w-px" />

        <ButtonTooltip label={i18n.t("sidepanel.selectionBar.clear")} keys={["escape"]}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={i18n.t("sidepanel.selectionBar.clear")}
            onClick={() => clearSelection()}
            className="press-feedback rounded-full"
          >
            <Icons.X />
          </Button>
        </ButtonTooltip>
      </div>
    </div>
  );
}
