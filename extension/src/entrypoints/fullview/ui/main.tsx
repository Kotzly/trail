import '@ui/panel/styles.css';
import { mountPanelApp } from '@ui/panel/bootstrap.js';
import { readLayoutCache } from '@shared/graph-layout-cache/cache.js';

// Pre-fetch cached layout BEFORE React mounts
const cachePromise = readLayoutCache('active');

async function mount(): Promise<void> {
  const cached = await cachePromise;
  mountPanelApp({ cachedLayout: cached });
}

void mount();
