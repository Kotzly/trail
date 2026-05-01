import { test, expect } from "./fixtures.js";

test("extension loads and registers a service worker", async ({
  serviceWorker,
  extensionId,
}) => {
  expect(serviceWorker.url()).toContain(`chrome-extension://${extensionId}/`);
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test("settings page renders without runtime errors and lists every nav section", async ({
  context,
  extensionId,
}) => {
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(page.getByTestId("settings-app")).toBeVisible();

  for (const id of [
    "trees",
    "appearance",
    "behavior",
    "shortcuts",
    "privacy",
    "about",
  ]) {
    await expect(page.getByTestId(`settings-nav-${id}`)).toBeVisible();
  }

  expect(
    errors,
    `unexpected pageerror events: ${errors.join("; ")}`,
  ).toEqual([]);
});

test("about page exposes feedback action buttons", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/settings.html`);

  await page.getByTestId("settings-nav-about").click();

  await expect(page.getByTestId("about-feedback-bug")).toBeVisible();
  await expect(page.getByTestId("about-feedback-feature")).toBeVisible();
  await expect(page.getByTestId("about-feedback-support")).toBeVisible();
});
