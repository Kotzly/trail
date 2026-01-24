import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import SettingsPopover from './components/SettingsPopover.js';
import ThemePanel from './components/theme/ThemePanel.js';
import ContextMenus from './components/ContextMenus.js';
import NotificationsHost from './components/NotificationsHost.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useAccount } from './hooks/useAccount.js';
import { useChromeMessages } from './hooks/useChromeMessages.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import { useStore } from './state/store.js';
import React from 'react';

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tooltipsOpen = useStore((state) => state.ui.tooltipsOpen);

  useBootstrap();
  useAccount();
  useChromeMessages();
  useShortcuts(searchInputRef);

  return (
    <div className={`container${tooltipsOpen ? ' show-tooltips' : ''}`}>
      <FloatingControls searchInputRef={searchInputRef} />
      <NotificationsHost />
      <GraphArea />
      <SettingsPopover />
      <ThemePanel />
      <ContextMenus />
    </div>
  );
}
