import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { validateNodeData } from "../src/shared/schemas/node.js";

// `validateNodeData` accepts untrusted node payloads (sync pull, import
// bundles). When a parse fails specifically because of a bad
// `visitCount` (zero, negative, NaN, non-number), it strips the field
// and retries — but the strip should be observable, otherwise these
// silent corrections accumulate without anyone noticing the upstream
// producer is shipping bad data.
//
// These tests pin the behaviour: the function still recovers when
// stripping helps, falls back to defaults when nothing helps, AND
// emits exactly one `console.warn` (the logger's warn channel) when
// it strips visitCount from an input that actually had the field.

function withCapturedWarn<T>(fn: () => T): { result: T; warnCalls: unknown[][] } {
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    const result = fn();
    return { result, warnCalls: calls };
  } finally {
    console.warn = original;
  }
}

describe("validateNodeData: happy path", () => {
  it("passes through a valid payload unchanged (no warn)", () => {
    const { result, warnCalls } = withCapturedWarn(() =>
      validateNodeData({
        url: "https://example.com/",
        title: "Example",
        pinned: true,
        tags: ["a", "b"],
        visitCount: 3,
      }),
    );
    assert.equal(result.url, "https://example.com/");
    assert.equal(result.title, "Example");
    assert.equal(result.pinned, true);
    assert.deepEqual(result.tags, ["a", "b"]);
    assert.equal(result.visitCount, 3);
    assert.equal(warnCalls.length, 0, "valid payload must not emit warn");
  });

  it("unwraps a `{ data: ... }` envelope", () => {
    const { result, warnCalls } = withCapturedWarn(() =>
      validateNodeData({ data: { url: "https://e.com/", pinned: false } }),
    );
    assert.equal(result.url, "https://e.com/");
    assert.equal(result.pinned, false);
    assert.equal(warnCalls.length, 0);
  });
});

describe("validateNodeData: visitCount strip + log", () => {
  it("strips a non-positive visitCount and logs once", () => {
    const { result, warnCalls } = withCapturedWarn(() =>
      validateNodeData({
        url: "https://example.com/",
        title: "T",
        pinned: false,
        visitCount: 0, // refine rejects: must be > 0
      }),
    );
    // Rest of the node is preserved
    assert.equal(result.url, "https://example.com/");
    assert.equal(result.title, "T");
    // visitCount was dropped
    assert.equal(result.visitCount, undefined);
    // Exactly one warn fired — not one per parse attempt
    assert.equal(warnCalls.length, 1, "exactly one warn per call");
    // Payload mentions the field name and the sample value
    const serialized = JSON.stringify(warnCalls[0]);
    assert.match(serialized, /visitCount/, "warn payload references visitCount");
    assert.match(serialized, /sampleValue/, "warn payload includes sampleValue");
  });

  it("strips a negative visitCount", () => {
    const { result, warnCalls } = withCapturedWarn(() =>
      validateNodeData({
        url: "https://example.com/",
        pinned: false,
        visitCount: -5,
      }),
    );
    assert.equal(result.url, "https://example.com/");
    assert.equal(result.visitCount, undefined);
    assert.equal(warnCalls.length, 1);
  });

  it("strips a non-numeric visitCount", () => {
    const { result, warnCalls } = withCapturedWarn(() =>
      validateNodeData({
        url: "https://example.com/",
        pinned: false,
        visitCount: "not-a-number",
      }),
    );
    assert.equal(result.url, "https://example.com/");
    assert.equal(result.visitCount, undefined);
    assert.equal(warnCalls.length, 1);
  });
});

describe("validateNodeData: fallthrough", () => {
  it("falls back to defaults on a primitive input (no warn — nothing to strip)", () => {
    const { result, warnCalls } = withCapturedWarn(() => validateNodeData(42));
    assert.equal(result.url, "");
    assert.equal(result.title, "");
    assert.equal(result.pinned, false);
    assert.deepEqual(result.tags, []);
    assert.equal(
      warnCalls.length,
      0,
      "primitive input has no visitCount field — must not log a strip",
    );
  });

  it("falls back to defaults on null", () => {
    const { result, warnCalls } = withCapturedWarn(() => validateNodeData(null));
    assert.equal(result.url, "");
    assert.equal(result.pinned, false);
    assert.equal(warnCalls.length, 0);
  });
});
