import type { SpotlightNodeResult, SpotlightSearchResult, SpotlightBatchActionId } from './types.js';

type BatchAction = {
  id: SpotlightBatchActionId;
  title: string;
  destructive: boolean;
};

type SpotlightBatchBarProps = {
  selectedItems: SpotlightSearchResult[];
  activeTreeId: string | null;
  onExecute: (actionId: SpotlightBatchActionId) => void;
  onClear: () => void;
};

export function SpotlightBatchBar({ selectedItems, activeTreeId, onExecute, onClear }: SpotlightBatchBarProps) {
  const actions = buildBatchActions(selectedItems, activeTreeId);

  return (
    <div className="spotlight-batch-bar">
      <span className="spotlight-batch-count">{selectedItems.length} selected</span>
      <div className="spotlight-batch-actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="spotlight-batch-btn"
            data-destructive={action.destructive}
            onClick={() => onExecute(action.id)}
          >
            {action.title}
          </button>
        ))}
      </div>
      <button type="button" className="spotlight-batch-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export function buildBatchActions(
  items: SpotlightSearchResult[],
  activeTreeId: string | null,
): BatchAction[] {
  const nodes = items.filter((i): i is SpotlightNodeResult => i.kind === 'node');
  if (nodes.length === 0) return [];

  const actions: BatchAction[] = [];
  const allInActiveTree = activeTreeId !== null && nodes.every((n) => n.treeId === activeTreeId);

  actions.push({ id: 'batch-copy-urls', title: `Copy ${nodes.length} URLs`, destructive: false });

  if (allInActiveTree) {
    const tabNodes = nodes.filter((n) => n.tabCount > 0);
    if (tabNodes.length === nodes.length) {
      actions.push({ id: 'batch-close-tabs', title: `Close ${tabNodes.length} tabs`, destructive: true });
    }

    const allUnpinned = nodes.every((n) => !n.pinned);
    const allPinned = nodes.every((n) => n.pinned);
    if (allUnpinned) {
      actions.push({ id: 'batch-pin', title: `Pin ${nodes.length}`, destructive: false });
    } else if (allPinned) {
      actions.push({ id: 'batch-unpin', title: `Unpin ${nodes.length}`, destructive: false });
    }
  }

  return actions;
}
