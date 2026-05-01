import { test, expect } from "./fixtures.js";

test.describe("onboarding", () => {
  test("wizard mounts on first sidepanel open, advances on next CTA, dismisses on skip, persists dismissal", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    const wizard = page.getByTestId("onboarding-wizard");
    await expect(wizard).toBeVisible({ timeout: 10_000 });

    // Advance one step via the primary CTA. Wizard remains mounted (we
    // moved to the next step, not closed it). This is the structural
    // assertion — we don't care which copy the heading shows.
    await wizard.getByTestId("onboarding-next").click();
    await expect(wizard).toBeVisible();

    // Skip dismisses the wizard.
    await wizard.getByTestId("onboarding-skip").click();
    await expect(wizard).toBeHidden({ timeout: 5_000 });

    // Dismissal must persist across reload (phase recorded as "done"
    // somewhere in extension storage). We verify behaviorally rather
    // than poking the storage key directly.
    await page.reload();
    await expect(page.getByTestId("onboarding-wizard")).toBeHidden({
      timeout: 5_000,
    });
  });

  test("privacy page renders without runtime errors and exposes the skip-incognito switch", async ({
    context,
    extensionId,
  }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`chrome-extension://${extensionId}/settings.html`);
    await expect(page.getByTestId("settings-app")).toBeVisible();

    await page.getByTestId("settings-nav-privacy").click();

    // Switch is wired by stable id (not text), so this is locale-proof.
    await expect(page.locator("#skip-incognito")).toBeVisible();

    expect(
      errors,
      `unexpected pageerror events: ${errors.join("; ")}`,
    ).toEqual([]);
  });
});
