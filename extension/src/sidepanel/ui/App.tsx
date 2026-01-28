import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import SettingsPopover from './components/SettingsPopover.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import DeleteTreeConfirmModal from './components/DeleteTreeConfirmModal.js';
import OnboardingOverlay from './components/OnboardingOverlay.js';
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
  const bootstrapped = Boolean(settings);
  useBootstrap();
  useAccount();
  useChromeMessages();
  listenSystemTheme();
  useShortcuts(searchInputRef);

  return (
    <div className="container">
      {!bootstrapped ? <TrailLoader /> : null}
      <FloatingControls searchInputRef={searchInputRef} />
      <NotificationsHost />
      <GraphArea />
      <OnboardingOverlay />
      <SettingsPopover />
      <ThemePanel />
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
