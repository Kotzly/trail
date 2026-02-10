import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import DeleteTreeConfirmModal from './components/DeleteTreeConfirmModal.js';
import AuthGate from './components/AuthGate.js';
import NotificationsHost from './components/NotificationsHost.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useAccount } from './hooks/useAccount.js';
import { useChromeMessages } from './hooks/useChromeMessages.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import TooltipLayer from './components/TooltipLayer.js';
import React from 'react';
import { listenSystemTheme } from './hooks/listenSystemTheme.js';
import { useStore } from './state/store.js';

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const account = useStore((state) => state.account);
  const editorActive = useStore((state) => state.editorMode.active);

  useBootstrap();
  useAccount();
  useChromeMessages();
  listenSystemTheme();
  useShortcuts(searchInputRef);

  const isAuthenticated =
    account.session.status === 'authenticated' && Boolean(account.user);

  const containerClass = `container${editorActive ? ' container--editor' : ''}`;

  // Auth gate: block everything until authenticated.
  // Graph components are NOT mounted — conditional render, not overlay.
  if (!isAuthenticated) {
    return (
      <div className={containerClass}>
        <AuthGate />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <FloatingControls searchInputRef={searchInputRef} />
      <NotificationsHost />
      <GraphArea />
      <ThemePanel />
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
