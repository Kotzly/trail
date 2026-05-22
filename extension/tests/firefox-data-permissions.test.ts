/**
 * Fail-closed contract for the Firefox data-collection permission gate.
 *
 * The privacy gate must never grant telemetry on the strength of an
 * error from the WebExtension `permissions` API. When `contains` or
 * `request` rejects, the gate must return `false` (denied), not `true`.
 *
 * The public `hasTelemetryPermission` / `requestTelemetryPermission`
 * short-circuit on non-Firefox builds via `import.meta.env.FIREFOX`,
 * which is undefined under `node --import tsx`. So we exercise the
 * inner helpers `probeTelemetryPermission` / `askForTelemetryPermission`
 * directly — they take the WebExtension method as a parameter and
 * carry the catch-handler whose privacy contract we are pinning down.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  probeTelemetryPermission,
  askForTelemetryPermission,
} from "../src/shared/lib/firefox-data-permissions.js";

describe("firefox-data-permissions / fail-closed contract", () => {
  it("probeTelemetryPermission returns false when contains() rejects", async () => {
    const result = await probeTelemetryPermission(async () => {
      throw new Error("simulated webext failure");
    });
    assert.equal(result, false, "must fail closed on rejection");
  });

  it("probeTelemetryPermission returns false when contains() rejects asynchronously", async () => {
    const result = await probeTelemetryPermission(
      () => Promise.reject(new Error("async failure")),
    );
    assert.equal(result, false, "must fail closed on promise rejection");
  });

  it("probeTelemetryPermission returns false when contains() throws synchronously", async () => {
    const result = await probeTelemetryPermission(((): Promise<boolean> => {
      throw new Error("sync throw");
    }) as (perms: { data_collection?: string[] }) => Promise<boolean>);
    assert.equal(result, false, "must fail closed on sync throw");
  });

  it("probeTelemetryPermission preserves a truthful granted=true result", async () => {
    const result = await probeTelemetryPermission(async () => true);
    assert.equal(result, true, "must surface a real grant");
  });

  it("probeTelemetryPermission preserves a truthful denied=false result", async () => {
    const result = await probeTelemetryPermission(async () => false);
    assert.equal(result, false, "must surface a real denial");
  });

  it("probeTelemetryPermission forwards the data_collection permission shape", async () => {
    let received: { data_collection?: string[] } | null = null;
    await probeTelemetryPermission(async (perms) => {
      received = perms;
      return true;
    });
    assert.deepEqual(received, { data_collection: ["technicalAndInteraction"] });
  });

  it("askForTelemetryPermission returns false when request() rejects", async () => {
    const result = await askForTelemetryPermission(async () => {
      throw new Error("user dialog blew up");
    });
    assert.equal(result, false, "must fail closed on rejection");
  });

  it("askForTelemetryPermission returns false when request() rejects asynchronously", async () => {
    const result = await askForTelemetryPermission(
      () => Promise.reject(new Error("async failure")),
    );
    assert.equal(result, false, "must fail closed on promise rejection");
  });

  it("askForTelemetryPermission preserves a truthful granted=true result", async () => {
    const result = await askForTelemetryPermission(async () => true);
    assert.equal(result, true, "must surface a real grant");
  });

  it("askForTelemetryPermission preserves a truthful denied=false result", async () => {
    const result = await askForTelemetryPermission(async () => false);
    assert.equal(result, false, "must surface a real denial");
  });

  it("askForTelemetryPermission forwards the data_collection permission shape", async () => {
    let received: { data_collection?: string[] } | null = null;
    await askForTelemetryPermission(async (perms) => {
      received = perms;
      return true;
    });
    assert.deepEqual(received, { data_collection: ["technicalAndInteraction"] });
  });
});
