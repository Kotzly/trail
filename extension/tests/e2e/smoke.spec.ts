import { test, expect } from "./fixtures.js";

test("extension loads and registers a service worker", async ({ serviceWorker, extensionId }) => {
  // If we got here, the service worker fixture resolved — i.e. Chromium
  // accepted our unpacked extension and the background script started.
  expect(serviceWorker.url()).toContain(`chrome-extension://${extensionId}/`);
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test("settings page renders Account as default landing", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/settings.html`);

  // Left nav should list every page we added in Wave 6.
  await expect(page.getByRole("heading", { name: "Trail Settings" })).toBeVisible();
  for (const label of ["Account", "Data", "Appearance", "Behavior", "Shortcuts", "Privacy", "About"]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }

  // Account page is default.
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
});

test("About page exposes bug report + feature request + support", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/settings.html`);

  await page.getByRole("button", { name: "About" }).click();
  await expect(page.getByRole("button", { name: "Report a bug" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suggest a feature" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Contact support" })).toBeVisible();
});
