import { createRoot, type Root } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import './style.css';

// WXT runtime-registered content script — built but not auto-injected.
// Injected programmatically by background/spotlight-command.ts via chrome.scripting.executeScript.
// NOTE: WXT adds matches to host_permissions in manifest. <all_urls> is needed for
// scripting.executeScript to work on any tab (activeTab alone isn't sufficient for CSS injection).
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  allFrames: false,

  async main(ctx) {
    console.log('[Spotlight] Content script main() started');

    // Guard against duplicate injection (re-inject after message failure
    // adds another content script instance with its own listeners)
    const MOUNT_FLAG = '__trailSpotlightMounted';
    if ((window as Record<string, unknown>)[MOUNT_FLAG]) {
      console.log('[Spotlight] Already mounted, skipping');
      return;
    }
    (window as Record<string, unknown>)[MOUNT_FLAG] = true;

    let toggleFn: (() => void) | null = null;

    const ui = await createShadowRootUi(ctx as never, {
      name: 'trail-spotlight',
      position: 'overlay',
      zIndex: 2147483647,
      onMount: (container) => {
        const root = createRoot(container);

        // Lazy-load the actual spotlight app
        import('../../spotlight/SpotlightApp.js').then(({ SpotlightApp }) => {
          root.render(<SpotlightApp onRegisterToggle={(fn) => { toggleFn = fn; }} />);
        });

        return { root } satisfies MountHandle;
      },
      onRemove: (handle?: MountHandle) => {
        handle?.root.unmount();
      },
    });

    ui.mount();
    console.log('[Spotlight] Shadow root UI mounted');

    // Auto-open on first injection
    // Small delay to let React mount
    setTimeout(() => {
      console.log('[Spotlight] Auto-open firing, toggleFn exists:', !!toggleFn);
      toggleFn?.();
    }, 50);

    // Listen for subsequent toggle messages from background
    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type === 'TOGGLE_SPOTLIGHT') {
        toggleFn?.();
      }
    });

    // Keyboard shortcut as backup (in case Chrome command doesn't fire)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggleFn?.();
      }
    }, true);
  },
});

type MountHandle = { root: Root };
