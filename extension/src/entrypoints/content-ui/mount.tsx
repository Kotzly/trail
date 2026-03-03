import { createRoot, type Root } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

import App from './App.js';
import './styles.css';

type MountHandle = {
  root: Root;
};

export async function mountContentUi(ctx: unknown): Promise<void> {
  const ui = await createShadowRootUi(ctx as never, {
    name: 'trail-content-ui',
    position: 'inline',
    anchor: 'body',
    append: 'first',
    onMount: (container) => {
      const root = createRoot(container);
      root.render(<App />);
      return { root } satisfies MountHandle;
    },
    onRemove: (handle?: MountHandle) => {
      handle?.root.unmount();
    },
  });

  ui.mount();
}
