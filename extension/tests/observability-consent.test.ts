/**
 * Consent re-grant must restart the analytics clients without a surface
 * reload (regression coverage for the "user denies → re-grants →
 * silence until reload" bug).
 *
 * The orchestration runs through `applyConsent`, which is a pure function
 * exported from `observability/consent-runtime.ts` that routes the
 * consent flags through the supplied hooks. We deliberately import only
 * that module so the test doesn't pull in `wxt/utils/storage` (which the
 * node-based unit test harness can't load).
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  applyConsent,
  type ObservabilityHooks,
} from "../src/shared/lib/observability/consent-runtime.js";
import type { ObservabilitySurface } from "../src/shared/lib/observability/types.js";

type HookCalls = {
  startSentry: number;
  stopSentry: number;
  startPostHog: number;
  stopPostHog: number;
  lastStartSentrySurface: ObservabilitySurface | null;
  lastStartPostHogSurface: ObservabilitySurface | null;
};

function spyHooks(): { calls: HookCalls; hooks: ObservabilityHooks } {
  const calls: HookCalls = {
    startSentry: 0,
    stopSentry: 0,
    startPostHog: 0,
    stopPostHog: 0,
    lastStartSentrySurface: null,
    lastStartPostHogSurface: null,
  };
  const hooks: ObservabilityHooks = {
    startSentry: (surface) => {
      calls.startSentry++;
      calls.lastStartSentrySurface = surface;
    },
    stopSentry: async () => {
      calls.stopSentry++;
    },
    startPostHog: async (surface) => {
      calls.startPostHog++;
      calls.lastStartPostHogSurface = surface;
    },
    stopPostHog: () => {
      calls.stopPostHog++;
    },
  };
  return { calls, hooks };
}

describe("observability consent flow", () => {
  it("starts both clients when consent is granted up-front", async () => {
    const { calls, hooks } = spyHooks();
    await applyConsent(
      { errors: true, analytics: true, decidedAt: 0 },
      "sidepanel",
      hooks,
    );
    assert.equal(calls.startSentry, 1);
    assert.equal(calls.startPostHog, 1);
    assert.equal(calls.stopSentry, 0);
    assert.equal(calls.stopPostHog, 0);
    assert.equal(calls.lastStartSentrySurface, "sidepanel");
    assert.equal(calls.lastStartPostHogSurface, "sidepanel");
  });

  it("starts no clients when both signals are denied", async () => {
    const { calls, hooks } = spyHooks();
    await applyConsent(
      { errors: false, analytics: false, decidedAt: 0 },
      "sidepanel",
      hooks,
    );
    assert.equal(calls.startSentry, 0);
    assert.equal(calls.startPostHog, 0);
    // Stops still fire — the real impls short-circuit when already off,
    // so this is safe.
    assert.equal(calls.stopSentry, 1);
    assert.equal(calls.stopPostHog, 1);
  });

  it("re-grant after deny brings clients back online", async () => {
    // This is the original bug: deny then re-grant used to leave Sentry
    // and PostHog dormant until the surface was reloaded.
    const { calls, hooks } = spyHooks();

    await applyConsent(
      { errors: false, analytics: false, decidedAt: 0 },
      "sidepanel",
      hooks,
    );
    assert.equal(calls.startSentry, 0);
    assert.equal(calls.startPostHog, 0);

    await applyConsent(
      { errors: true, analytics: true, decidedAt: 1 },
      "sidepanel",
      hooks,
    );
    assert.equal(calls.startSentry, 1, "Sentry must be started on re-grant");
    assert.equal(calls.startPostHog, 1, "PostHog must be started on re-grant");
  });

  it("partial consent maps to per-client start/stop", async () => {
    const { calls, hooks } = spyHooks();

    // Errors on, analytics off.
    await applyConsent(
      { errors: true, analytics: false, decidedAt: 0 },
      "settings",
      hooks,
    );
    assert.equal(calls.startSentry, 1);
    assert.equal(calls.startPostHog, 0);
    assert.equal(calls.stopSentry, 0);
    assert.equal(calls.stopPostHog, 1);

    // Flip: errors off, analytics on.
    await applyConsent(
      { errors: false, analytics: true, decidedAt: 1 },
      "settings",
      hooks,
    );
    assert.equal(calls.startSentry, 1, "Sentry must not start again");
    assert.equal(calls.startPostHog, 1, "PostHog must start now");
    assert.equal(calls.stopSentry, 1, "Sentry must stop on flip-off");
    assert.equal(calls.stopPostHog, 1);
  });

  it("revoke after grant tears clients down", async () => {
    const { calls, hooks } = spyHooks();

    await applyConsent(
      { errors: true, analytics: true, decidedAt: 0 },
      "sidepanel",
      hooks,
    );
    assert.equal(calls.startSentry, 1);
    assert.equal(calls.startPostHog, 1);

    await applyConsent(
      { errors: false, analytics: false, decidedAt: 1 },
      "sidepanel",
      hooks,
    );
    assert.equal(calls.stopSentry, 1, "Sentry must stop on revoke");
    assert.equal(calls.stopPostHog, 1, "PostHog must stop on revoke");
  });

  it("passes the current surface through to start hooks", async () => {
    const { calls, hooks } = spyHooks();
    await applyConsent(
      { errors: true, analytics: true, decidedAt: 0 },
      "login",
      hooks,
    );
    assert.equal(calls.lastStartSentrySurface, "login");
    assert.equal(calls.lastStartPostHogSurface, "login");
  });
});
