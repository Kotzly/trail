import { test as base, chromium, type BrowserContext, type Worker } from "@playwright/test";
import { resolve } from "node:path";

const EXTENSION_PATH = resolve(__dirname, "../../.output/chrome-mv3");

export type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    // Persistent context + --load-extension is the only reliable way to
    // run an MV3 unpacked extension under Playwright. Non-headless because
    // MV3 service workers are currently not fully supported in headless.
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 15_000 });
    }
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => {
    // Service worker URL: chrome-extension://<id>/background.js
    const match = serviceWorker.url().match(/chrome-extension:\/\/([a-z]+)\//);
    if (!match) throw new Error(`Cannot parse extension id from ${serviceWorker.url()}`);
    await use(match[1]!);
  },
});

export { expect } from "@playwright/test";
