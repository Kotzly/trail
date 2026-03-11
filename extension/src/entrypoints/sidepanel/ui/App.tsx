import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import DeleteTreeConfirmModal from './components/DeleteTreeConfirmModal.js';
import AuthGate from './components/AuthGate.js';
import { Toaster } from './components/ui/sonner.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useAccount } from './hooks/useAccount.js';
import { useRuntimeMessages } from './hooks/useRuntimeMessages.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import TooltipLayer from './components/TooltipLayer.js';

import { listenSystemTheme } from './hooks/listenSystemTheme.js';
import { useStore } from './state/store.js';

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const account = useStore((state) => state.account);
  const editorActive = useStore((state) => state.editorMode.active);

  useBootstrap();
  useAccount();
  useRuntimeMessages();
  listenSystemTheme();
  useShortcuts(searchInputRef);

  const isAuthenticated = true; // temp
    // account.session.status === 'authenticated' && Boolean(account.user);

  const containerClass = `container${editorActive ? ' container--editor' : ''}`;

  return (
    <div className={containerClass}>
      <Toaster />
      {!isAuthenticated ? (
        <AuthGate />
      ) : (
        <>
          <FloatingControls searchInputRef={searchInputRef} />
          <GraphArea />
          <ThemePanel />
          <DeleteTreeConfirmModal />
          <ContextMenus />
          <TooltipLayer />
        </>
      )}
    </div>
  );
}
