import 'pixi.js/unsafe-eval';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './sidepanel.css';
import React from 'react';
import { initBackendConfig } from '../../shared/config/backend.js';

// Notify background that the sidepanel is alive (used to skip redundant
// setOptions/open calls that would reload the panel and cause a theme flash).
chrome.runtime.connect({ name: 'sidepanel' });

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

void initBackendConfig();

createRoot(rootEl).render(<App />);
