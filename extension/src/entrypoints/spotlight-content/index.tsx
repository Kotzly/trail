import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { browser } from "wxt/browser";
import "./style.css";

// Eagerly start loading the spotlight chunk on page load
// so it's ready by the time the user presses the shortcut.
const spotlightChunk = import("@features/spotlight/ui/SpotlightApp.js");

// Manifest-registered content script — auto-injected on all pages.
// No scripting.executeScript needed; toggle is instant.
export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  runAt: "document_idle",
  allFrames: false,

  async main(ctx) {
    const MOUNT_FLAG = "__trailSpotlightMounted";
    const globalWindow = window as unknown as Record<string, unknown>;
    if (globalWindow[MOUNT_FLAG]) return;
    globalWindow[MOUNT_FLAG] = true;

    let toggleFn: (() => void) | null = null;

    const ui = await createShadowRootUi(ctx as never, {
      name: "trail-spotlight",
      position: "overlay",
      zIndex: 2147483647,
      onMount: (container) => {
        const root = createRoot(container);

        const grainUrl = browser.runtime.getURL("/grain-bg.png");
        container.style.setProperty("--spotlight-grain-url", `url("${grainUrl}")`);

        spotlightChunk.then(({ SpotlightApp }) => {
          root.render(
            <SpotlightApp
              onRegisterToggle={(fn) => {
                toggleFn = fn;
              }}
            />,
          );
        });

        return { root } satisfies MountHandle;
      },
      onRemove: (handle?: MountHandle) => {
        handle?.root.unmount();
      },
    });

    ui.mount();

    // Listen for toggle messages from background
    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type === "TOGGLE_SPOTLIGHT") {
        toggleFn?.();
      }
    });
  },
});

type MountHandle = { root: Root };
