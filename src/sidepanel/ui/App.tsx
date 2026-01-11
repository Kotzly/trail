import { useRef } from 'react';
import FloatingControls from './components/FloatingControls.js';
import GraphArea from './components/graph/GraphArea.js';
import SettingsPopover from './components/SettingsPopover.js';
import ContextMenus from './components/ContextMenus.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useChromeMessages } from './hooks/useChromeMessages.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import React from 'react';

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  useBootstrap();
  useChromeMessages();
  useShortcuts(searchInputRef);

  return (
    <div className="container">
      <FloatingControls settingsBtnRef={settingsBtnRef} searchInputRef={searchInputRef} />
      <GraphArea />
      <SettingsPopover anchorRef={settingsBtnRef} />
      <ContextMenus />
    </div>
  );
}
