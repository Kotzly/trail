import { test, expect } from "./fixtures.js";

test.describe("onboarding", () => {
  test("wizard opens on first sidepanel mount and can be dismissed", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Wizard title indicates we're in the first step
    await expect(page.getByRole("heading", { name: "Welcome to Trail" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Step 1 of 6/i)).toBeVisible();

    // Advance → step 2
    await page.getByRole("button", { name: "Next" }).first().click();
    await expect(page.getByRole("heading", { name: "How Trail works" })).toBeVisible();

    // Skip from step 2 should close the wizard and NOT re-open on reload
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("heading", { name: /Welcome to Trail/i })).toBeHidden({
      timeout: 5_000,
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: /Welcome to Trail/i })).toBeHidden({
      timeout: 5_000,
    });
  });

  test("privacy page shows blocklist textarea with defaults", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/settings.html`);

    await page.getByRole("button", { name: "Privacy" }).click();
    await expect(page.getByRole("heading", { name: "What Trail records" })).toBeVisible();
    await expect(page.getByLabel("Skip incognito windows")).toBeChecked();

    const blocklist = page.getByLabel("Blocked hostnames");
    await expect(blocklist).toBeVisible();
    const value = await blocklist.inputValue();
    expect(value).toContain("localhost");
  });
});
