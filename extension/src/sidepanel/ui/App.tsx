import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import SettingsPopover from './components/SettingsPopover.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import DeleteTreeConfirmModal from './components/DeleteTreeConfirmModal.js';
import AuthGate from './components/AuthGate.js';
import EditorToolbar from './components/EditorToolbar.js';
import NotificationsHost from './components/NotificationsHost.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useAccount } from './hooks/useAccount.js';
import { useChromeMessages } from './hooks/useChromeMessages.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import TooltipLayer from './components/TooltipLayer.js';
import React from 'react';
import { listenSystemTheme } from './hooks/listenSystemTheme.js';
import TrailLoader from './components/TrailLoader.js';
import { useStore } from './state/store.js';

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settings = useStore((state) => state.settings);
  const account = useStore((state) => state.account);
  const bootstrapped = Boolean(settings);

  useBootstrap();
  useAccount();
  useChromeMessages();
  listenSystemTheme();
  useShortcuts(searchInputRef);

  const isAuthenticated =
    account.session.status === 'authenticated' && Boolean(account.user);

  // Auth gate: block everything until authenticated.
  // Graph components are NOT mounted — conditional render, not overlay.
  if (!isAuthenticated) {
    return (
      <div className="container">
        {!bootstrapped ? <TrailLoader /> : <AuthGate />}
      </div>
    );
  }

  return (
    <div className="container">
      {!bootstrapped ? <TrailLoader /> : null}
      <EditorToolbar />
      <FloatingControls searchInputRef={searchInputRef} />
      <NotificationsHost />
      <GraphArea />
      <SettingsPopover />
      <ThemePanel />
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
