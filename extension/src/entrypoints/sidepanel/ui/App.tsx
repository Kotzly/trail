import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import DeleteTreeConfirmModal from './components/DeleteTreeConfirmModal.js';
import SessionExpiredBanner from './components/SessionExpiredBanner.js';
import { Toaster } from './components/ui/sonner.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useAccount } from './hooks/useAccount.js';
import { useAuthPolicy } from './hooks/useAuthPolicy.js';
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
  useAuthPolicy();
  useRuntimeMessages();
  listenSystemTheme();
  useShortcuts(searchInputRef);

  const isAuthenticated =
    account.session.status === 'authenticated' && Boolean(account.user);

  const showSessionBanner =
    !isAuthenticated && !account.authRequired && account.sessionExpired;

  const containerClass = `container${editorActive ? ' container--editor' : ''}`;

  return (
    <div className={containerClass}>
      <Toaster />
      {showSessionBanner && <SessionExpiredBanner />}
      <FloatingControls searchInputRef={searchInputRef} />
      <GraphArea />
      <ThemePanel />
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
