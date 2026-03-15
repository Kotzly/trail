import { useCallback, useEffect, useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import DeleteTreeConfirmModal from './components/DeleteTreeConfirmModal.js';
import AuthGate from './components/AuthGate.js';
import WelcomeGate from './components/WelcomeGate.js';
import SessionExpiredBanner from './components/SessionExpiredBanner.js';
import { Toaster } from './components/ui/sonner.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useAccount } from './hooks/useAccount.js';
import { useAuthPolicy } from './hooks/useAuthPolicy.js';
import { useRuntimeMessages } from './hooks/useRuntimeMessages.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import TooltipLayer from './components/TooltipLayer.js';
import { SpotlightApp } from '../../../spotlight/SpotlightApp.js';
import { browser } from '@shared/platform/webext.js';

import { listenSystemTheme } from './hooks/listenSystemTheme.js';
import { useStore } from './state/store.js';

const IS_FULLVIEW = window.location.pathname.endsWith('fullview.html');

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const account = useStore((state) => state.account);
  const editorActive = useStore((state) => state.editorMode.active);
  const spotlightToggleRef = useRef<(() => void) | null>(null);

  const handleRegisterToggle = useCallback((toggle: () => void) => {
    spotlightToggleRef.current = toggle;
  }, []);

  // Listen for TOGGLE_SPOTLIGHT message from background (fullview only)
  useEffect(() => {
    if (!IS_FULLVIEW) return;
    const handler = (message: { type?: string }) => {
      if (message?.type === 'TOGGLE_SPOTLIGHT') {
        spotlightToggleRef.current?.();
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  // Keyboard shortcut Cmd+Shift+K for Spotlight (fullview only)
  useEffect(() => {
    if (!IS_FULLVIEW) return;
    const handler = (e: KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();
        spotlightToggleRef.current?.();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  useBootstrap();
  useAccount();
  useAuthPolicy();
  useRuntimeMessages();
  listenSystemTheme();
  useShortcuts(searchInputRef);

  const isAuthenticated =
    account.session.status === 'authenticated' && Boolean(account.user);

  const showBlockingAuthGate =
    !isAuthenticated && account.authRequired;

  const showWelcomeGate =
    !isAuthenticated && !account.authRequired && !account.guestWelcomeDismissed;

  const showSessionBanner =
    !isAuthenticated && !account.authRequired && account.sessionExpired;

  const containerClass = `container${editorActive ? ' container--editor' : ''}`;

  return (
    <div className={containerClass}>
      <Toaster />
      {showBlockingAuthGate ? (
        <AuthGate />
      ) : showWelcomeGate ? (
        <WelcomeGate />
      ) : (
        <>
          {showSessionBanner && <SessionExpiredBanner />}
          <FloatingControls searchInputRef={searchInputRef} />
          <GraphArea />
          <ThemePanel />
          <DeleteTreeConfirmModal />
          <ContextMenus />
          <TooltipLayer />
          {IS_FULLVIEW && <SpotlightApp onRegisterToggle={handleRegisterToggle} />}
        </>
      )}
    </div>
  );
}
