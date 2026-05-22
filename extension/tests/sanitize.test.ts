/**
 * Unit tests for the client-side snapshot sanitizer used by the
 * share-link feature. Focuses on the two stored-XSS / spoofing vectors:
 *
 *  1. `sanitizeUrl` must reject every scheme except http/https. The
 *     marketing share-viewer renders sanitized URLs as clickable
 *     <a href>, so `javascript:` / `data:` / `vbscript:` / etc. would
 *     give an attacker stored XSS.
 *
 *  2. `sanitizeTitle` must strip every unicode bidirectional-override
 *     and directional-mark codepoint, including the three classic
 *     spoofing marks (ALM, LRM, RLM) that the v1 regex missed.
 *
 * Run via `pnpm test` — wired into extension/package.json.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { sanitizeUrl, sanitizeTitle } from "../src/features/sharing/sanitize.js";

// ── sanitizeUrl: scheme allow-list ────────────────────────────────

describe("sanitizeUrl: scheme allow-list", () => {
  it("accepts http://", () => {
    assert.equal(sanitizeUrl("http://example.com/"), "http://example.com/");
    assert.equal(sanitizeUrl("http://example.com/path"), "http://example.com/path");
  });

  it("accepts https://", () => {
    assert.equal(sanitizeUrl("https://example.com/"), "https://example.com/");
    assert.equal(sanitizeUrl("https://example.com/path"), "https://example.com/path");
  });

  it("rejects javascript:", () => {
    assert.equal(sanitizeUrl("javascript:alert(1)"), "");
    assert.equal(sanitizeUrl("JavaScript:alert(1)"), "");
    // Whitespace-prefixed variant — `new URL` trims leading whitespace
    // before parsing, so this must still be rejected.
    assert.equal(sanitizeUrl(" javascript:alert(1)"), "");
  });

  it("rejects data: (including text/html which is the XSS-y subtype)", () => {
    assert.equal(sanitizeUrl("data:text/html,<script>alert(1)</script>"), "");
    assert.equal(sanitizeUrl("data:text/plain,hello"), "");
    assert.equal(sanitizeUrl("data:image/png;base64,iVBORw0KGgo="), "");
  });

  it("rejects vbscript:", () => {
    assert.equal(sanitizeUrl("vbscript:msgbox(1)"), "");
  });

  it("rejects chrome: and chrome-extension:", () => {
    assert.equal(sanitizeUrl("chrome://settings/"), "");
    assert.equal(sanitizeUrl("chrome-extension://abcdef/popup.html"), "");
  });

  it("rejects about:", () => {
    assert.equal(sanitizeUrl("about:blank"), "");
    assert.equal(sanitizeUrl("about:config"), "");
  });

  it("rejects file:", () => {
    assert.equal(sanitizeUrl("file:///etc/passwd"), "");
    assert.equal(sanitizeUrl("file:///Users/me/secret.txt"), "");
  });

  it("rejects blob:", () => {
    assert.equal(sanitizeUrl("blob:https://example.com/uuid-here"), "");
  });

  it("rejects view-source:", () => {
    assert.equal(sanitizeUrl("view-source:https://example.com/"), "");
  });

  it("rejects ftp:, ws:, wss: and other parsable-but-disallowed schemes", () => {
    assert.equal(sanitizeUrl("ftp://files.example.com/"), "");
    assert.equal(sanitizeUrl("ws://example.com/socket"), "");
    assert.equal(sanitizeUrl("wss://example.com/socket"), "");
    assert.equal(sanitizeUrl("mailto:user@example.com"), "");
  });

  it("returns '' for unparsable input", () => {
    assert.equal(sanitizeUrl("not a url"), "");
    assert.equal(sanitizeUrl(""), "");
  });

  it("still strips query and fragment from allowed schemes", () => {
    assert.equal(
      sanitizeUrl("https://example.com/path?token=secret#frag"),
      "https://example.com/path",
    );
    assert.equal(
      sanitizeUrl("http://example.com/?access_token=abc"),
      "http://example.com/",
    );
  });
});

// ── sanitizeTitle: BIDI / directional-mark stripping ──────────────

describe("sanitizeTitle: bidirectional spoofing codepoints", () => {
  // ── Newly-covered codepoints (the regex gap this PR closes) ────

  it("strips U+200E (LRM) — Left-to-Right Mark", () => {
    assert.equal(sanitizeTitle("safe‎.txt"), "safe.txt");
    // Bare LRM
    assert.equal(sanitizeTitle("‎"), "");
  });

  it("strips U+200F (RLM) — Right-to-Left Mark", () => {
    assert.equal(sanitizeTitle("safe‏.txt"), "safe.txt");
    assert.equal(sanitizeTitle("‏"), "");
  });

  it("strips U+061C (ALM) — Arabic Letter Mark", () => {
    assert.equal(sanitizeTitle("safe؜.txt"), "safe.txt");
    assert.equal(sanitizeTitle("؜"), "");
  });

  it("strips a combined LRM+RLM+ALM payload", () => {
    // Classic file-spoofing string: `safe‮‎‏؜gpj.exe`
    // should collapse to `safegpj.exe` — every override + mark gone.
    const spoofed = "safe‮‎‏؜gpj.exe";
    assert.equal(sanitizeTitle(spoofed), "safegpj.exe");
  });

  // ── Previously-covered codepoints (regression coverage) ────────

  it("strips U+202A–U+202E (LRE/RLE/PDF/LRO/RLO)", () => {
    assert.equal(sanitizeTitle("a‪b"), "ab"); // LRE
    assert.equal(sanitizeTitle("a‫b"), "ab"); // RLE
    assert.equal(sanitizeTitle("a‬b"), "ab"); // PDF
    assert.equal(sanitizeTitle("a‭b"), "ab"); // LRO
    assert.equal(sanitizeTitle("a‮b"), "ab"); // RLO
  });

  it("strips U+2066–U+2069 (LRI/RLI/FSI/PDI)", () => {
    assert.equal(sanitizeTitle("a⁦b"), "ab"); // LRI
    assert.equal(sanitizeTitle("a⁧b"), "ab"); // RLI
    assert.equal(sanitizeTitle("a⁨b"), "ab"); // FSI
    assert.equal(sanitizeTitle("a⁩b"), "ab"); // PDI
  });

  // ── Negative checks: visible characters survive ────────────────

  it("leaves ordinary unicode text alone", () => {
    assert.equal(sanitizeTitle("Привет мир"), "Привет мир");
    assert.equal(sanitizeTitle("café — résumé"), "café — résumé");
    assert.equal(sanitizeTitle("日本語"), "日本語");
    // Emoji
    assert.equal(sanitizeTitle("hello 🌳"), "hello 🌳");
  });

  it("handles empty input", () => {
    assert.equal(sanitizeTitle(""), "");
  });

  it("truncates to 256 chars after stripping", () => {
    // 300 'a's interleaved with LRM marks should strip to 300 'a's
    // then truncate to 256.
    const input = "a‎".repeat(300);
    const out = sanitizeTitle(input);
    assert.equal(out.length, 256);
    assert.equal(out, "a".repeat(256));
  });
});
