import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { rpc } from '../../../../shared/rpc/contracts.js';
import { fireAndForget } from '../../api/background.js';
import { createNewTree } from '../../api/tree.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { useStore } from '../state/store.js';


const DEFAULT_NEW_TREE_LABEL = 'Unnamed Tree';

export default function DeleteTreeConfirmModal() {
  const { open, rootId } = useStore((state) => state.deleteTreeConfirm);
  const tree = useStore((state) => state.tree);
  const clearSelection = useStore((state) => state.clearSelection);
  const close = useStore((state) => state.closeDeleteTreeConfirm);

  useOverlayEffects(open, { lod: true, blur: true, kind: 'modal' });

  const currentRootId = tree?.getRoot?.()?.id ?? null;
  const canAct = open && rootId !== null && rootId === currentRootId;

  useEffect(() => {
    if (!open) return;
    if (canAct) return;
    close();
  }, [canAct, close, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [close, open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const handleDelete = () => {
    if (!canAct || !rootId) return;
    close();
    clearSelection();
    fireAndForget(rpc.deleteWithChildren({ nodeId: rootId }));
  };

  const handleCreateNewTree = () => {
    close();
    clearSelection();
    void createNewTree(DEFAULT_NEW_TREE_LABEL);
  };

  return createPortal(
    <div
      className="confirm-overlay lod-enabler blur-enabler"
      onClick={close}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-title">
          This will delete the entire tree. What do you want to do?
        </div>
        <div className="confirm-actions">
          <button className="confirm-btn ghost" type="button" onClick={close}>
            Cancel
          </button>
          <button className="confirm-btn ghost" type="button" onClick={handleCreateNewTree}>
            Create new tree
          </button>
          <button className="confirm-btn danger" type="button" onClick={handleDelete}>
            Delete this tree
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
