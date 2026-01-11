import { createRoot } from 'react-dom/client';
import App from './App.js';
import './sidepanel.css';
import React from 'react';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(<App />);
