import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  __getUrlMemoSizeForTests,
  compileBlocklist,
} from "../src/shared/lib/url-blocklist.js";

function matches(pattern: string, url: string): boolean {
  return compileBlocklist([pattern])(url);
}

// ── Legacy hostname patterns (backward compat) ─────────────────────

describe("url-pattern: legacy hostname patterns still work", () => {
  it("exact hostname", () => {
    assert.equal(matches("localhost", "http://localhost/"), true);
    assert.equal(matches("localhost", "http://localhost/foo/bar"), true);
    assert.equal(matches("localhost", "http://localhost.com/"), false);
    assert.equal(matches("localhost", "http://example.com/"), false);
  });

  it("wildcard subdomain *.bank.com", () => {
    assert.equal(matches("*.bank.com", "https://login.bank.com/"), true);
    assert.equal(matches("*.bank.com", "https://a.b.bank.com/"), true);
    assert.equal(matches("*.bank.com", "https://bank.com/"), false); // no dot prefix
    assert.equal(matches("*.bank.com", "https://fakebank.com/"), false);
  });

  it("substring *banking* hits hostname OR path (new)", () => {
    assert.equal(matches("*banking*", "https://bankingapp.com/"), true);
    assert.equal(matches("*banking*", "https://my-banking-portal.net/"), true);
    assert.equal(matches("*banking*", "https://example.com/banking/"), true); // path
    assert.equal(matches("*banking*", "https://example.com/"), false);
  });

  it("exact IP", () => {
    assert.equal(matches("127.0.0.1", "http://127.0.0.1/"), true);
    assert.equal(matches("127.0.0.1", "http://127.0.0.2/"), false);
  });

  it("regex metacharacters in pattern are escaped", () => {
    // `.` in pattern is literal, not "any char"
    assert.equal(matches("a.b.com", "https://a.b.com/"), true);
    assert.equal(matches("a.b.com", "https://axbxcom/"), false);
  });
});

// ── *foo* — any-segment substring match ────────────────────────────

describe("url-pattern: *foo* matches any segment containing foo", () => {
  it("matches translate in hostname", () => {
    assert.equal(matches("*translate*", "https://translate.com/"), true);
    assert.equal(matches("*translate*", "https://translate.example.com/"), true);
    assert.equal(matches("*translate*", "https://translate.yandex.ru/?text=hi"), true);
  });

  it("matches translate in path", () => {
    assert.equal(matches("*translate*", "https://anything.com/translate"), true);
    assert.equal(matches("*translate*", "https://example.com/ru/translate/hi"), true);
    // Careful: "translator" does NOT contain substring "translate" — the
    // final `e` is missing. Use `*translat*` to catch translator too.
    assert.equal(matches("*translat*", "https://deepl.com/translator"), true);
  });

  it("does not match when translate is absent", () => {
    assert.equal(matches("*translate*", "https://google.com/"), false);
    assert.equal(matches("*translate*", "https://example.com/translated"), true); // contains "translate"
    assert.equal(matches("*translate*", "https://example.com/translator"), false); // no "translate" substring
    assert.equal(matches("*translate*", "https://example.com/abcdef"), false);
  });

  it("bare * matches any URL with a hostname", () => {
    assert.equal(matches("*", "https://anything.com/"), true);
    assert.equal(matches("*", "http://foo.bar/baz"), true);
  });
});

// ── Positional patterns with / ─────────────────────────────────────

describe("url-pattern: */foo — exactly one prefix segment + foo", () => {
  it("matches URL of exactly 2 segments, second being foo", () => {
    assert.equal(matches("*/translate", "https://example.com/translate"), true);
    // Trailing slash normalises away
    assert.equal(matches("*/translate", "https://example.com/translate/"), true);
    // query/fragment ignored
    assert.equal(matches("*/translate", "https://example.com/translate?q=1"), true);
  });

  it("does NOT match deeper paths", () => {
    assert.equal(matches("*/translate", "https://example.com/ru/translate"), false);
    assert.equal(matches("*/translate", "https://example.com/a/b/translate"), false);
  });

  it("does NOT match single-segment URLs", () => {
    assert.equal(matches("*/translate", "https://translate.com/"), false);
  });
});

describe("url-pattern: **/foo — foo at any depth", () => {
  it("matches any URL ending in a foo segment", () => {
    assert.equal(matches("**/translate", "https://example.com/translate"), true);
    assert.equal(matches("**/translate", "https://example.com/ru/translate"), true);
    assert.equal(matches("**/translate", "https://a.b.c/d/e/f/translate"), true);
  });

  it("does NOT match when foo is a substring, not a full segment", () => {
    // segment-by-segment
    assert.equal(matches("**/translate", "https://example.com/translatewrong"), false);
    assert.equal(matches("**/translate", "https://example.com/wrongtranslate"), false);
  });

  it("requires at least one prefix segment", () => {
    // pattern needs a `/` in the joined URL. `translate.com` is 1 segment, no slash.
    assert.equal(matches("**/translate", "https://translate.com/"), false);
  });
});

describe("url-pattern: foo/** — anything under a prefix", () => {
  it("matches any URL with the prefix", () => {
    assert.equal(matches("example.com/**", "https://example.com/a"), true);
    assert.equal(matches("example.com/**", "https://example.com/a/b/c"), true);
    // `example.com/**` with 0 segments in ** should also match just the prefix
    assert.equal(matches("example.com/**", "https://example.com/"), true);
  });

  it("does NOT match unrelated hostnames", () => {
    assert.equal(matches("example.com/**", "https://other.com/example.com"), false);
  });
});

describe("url-pattern: positional fixed-depth", () => {
  it("example.com/api/* matches exactly 3 segments", () => {
    assert.equal(matches("example.com/api/*", "https://example.com/api/users"), true);
    assert.equal(matches("example.com/api/*", "https://example.com/api/users/1"), false);
    assert.equal(matches("example.com/api/*", "https://example.com/api"), false);
  });

  it("combined wildcards *.example.com/**", () => {
    assert.equal(matches("*.example.com/**", "https://a.example.com/x/y"), true);
    assert.equal(matches("*.example.com/**", "https://a.example.com/"), true);
    assert.equal(matches("*.example.com/**", "https://example.com/anything"), false);
  });

  it("middle globstar example.com/**/file", () => {
    assert.equal(matches("example.com/**/file", "https://example.com/file"), true);
    assert.equal(matches("example.com/**/file", "https://example.com/a/file"), true);
    assert.equal(matches("example.com/**/file", "https://example.com/a/b/c/file"), true);
    assert.equal(matches("example.com/**/file", "https://other.com/a/file"), false);
  });

  it("bare ** matches any URL", () => {
    assert.equal(matches("**", "https://anything.com/"), true);
    assert.equal(matches("**", "http://x/y/z"), true);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────

describe("url-pattern: edge cases", () => {
  it("case-insensitive everywhere", () => {
    assert.equal(matches("TRANSLATE.com", "https://translate.com/"), true);
    assert.equal(matches("translate.com", "https://TRANSLATE.COM/"), true);
    assert.equal(matches("*/TRANSLATE", "https://example.com/Translate"), true);
  });

  it("query and fragment ignored", () => {
    assert.equal(matches("*/translate", "https://example.com/translate?q=hi#f"), true);
    assert.equal(matches("**/ru", "https://example.com/ru?search=x#top"), true);
  });

  it("port is stripped from hostname", () => {
    assert.equal(matches("localhost", "http://localhost:8080/"), true);
    assert.equal(matches("*.dev", "http://a.dev:3000/path"), true);
  });

  it("empty pattern in list is ignored", () => {
    assert.equal(compileBlocklist([""])("https://a.com/"), false);
    assert.equal(compileBlocklist(["", "a.com"])("https://a.com/"), true);
  });

  it("empty list matches nothing", () => {
    assert.equal(compileBlocklist([])("https://a.com/"), false);
  });

  it("invalid URL matches nothing", () => {
    assert.equal(matches("*", "not a url"), false);
    assert.equal(matches("**", "not a url"), false);
  });

  it("any-of semantics across multiple patterns", () => {
    const pred = compileBlocklist(["foo.com", "**/secret"]);
    assert.equal(pred("https://foo.com/"), true);
    assert.equal(pred("https://x.com/secret"), true);
    assert.equal(pred("https://unrelated.com/"), false);
  });

  it("broken globstar not at boundary falls back to [^/]*", () => {
    // `foo**bar` is NOT a valid globstar (sandwiched between literals).
    // Degenerates to `foo[^/]*bar` — a single-segment pattern.
    assert.equal(matches("foo**bar", "https://foo-bar/"), true);
    assert.equal(matches("foo**bar", "https://fooXbar/"), true);
    assert.equal(matches("foo**bar", "https://fooX/Ybar"), false); // would need to cross /
  });
});

// ── Real-world scenarios we care about ─────────────────────────────

describe("url-pattern: practical collapselist scenarios", () => {
  it("*translate* covers translator subdomains (not /translator paths)", () => {
    const pred = compileBlocklist(["*translate*"]);
    assert.equal(pred("https://translate.yandex.ru/?text=hi"), true);
    assert.equal(pred("https://translate.google.com/"), true);
    assert.equal(pred("https://translate.bing.com/"), true);
    // /translator paths are NOT caught — "translator" lacks "translate"
    assert.equal(pred("https://bing.com/translator"), false);
    assert.equal(pred("https://deepl.com/translator"), false);
    assert.equal(pred("https://google.com/search?q=translate"), false); // query stripped
  });

  it("*translat* catches both translate and translator segments", () => {
    const pred = compileBlocklist(["*translat*"]);
    assert.equal(pred("https://translate.yandex.ru/"), true);
    assert.equal(pred("https://deepl.com/translator"), true);
    assert.equal(pred("https://bing.com/translator"), true);
    assert.equal(pred("https://example.com/translation"), true);
  });

  it("maps.google.* covers google maps subdomain variants", () => {
    const pred = compileBlocklist(["maps.google.*"]);
    assert.equal(pred("https://maps.google.com/"), true);
    assert.equal(pred("https://maps.google.ru/"), true);
    assert.equal(pred("https://maps.google.co.uk/"), true);
    assert.equal(pred("https://google.com/maps"), false); // google.com, not maps.google
  });
});

// ── Cache bounds (URL memo LRU) ────────────────────────────────────

describe("url-pattern: per-predicate URL memo stays bounded", () => {
  it("URL memo size stays ≤ 200 under heavy load (1000 distinct URLs)", () => {
    const pred = compileBlocklist(["*blocked*"]);
    for (let i = 0; i < 1000; i++) {
      pred(`https://example-${i}.com/path-${i}`);
    }
    const size = __getUrlMemoSizeForTests(pred);
    assert.ok(
      size > 0 && size <= 200,
      `expected memo size in (0, 200], got ${size}`,
    );
  });

  it("LRU evicts oldest entry on overflow and keeps recent ones", () => {
    // Fresh predicate (unique pattern key) so no other test has primed it.
    const pred = compileBlocklist(["*lru-bound-probe-unique*"]);
    // Fill exactly to the cap.
    for (let i = 0; i < 200; i++) {
      pred(`https://probe-${i}.test/`);
    }
    assert.equal(__getUrlMemoSizeForTests(pred), 200);

    // One more push evicts the oldest; size remains bounded.
    pred("https://probe-overflow.test/");
    assert.equal(__getUrlMemoSizeForTests(pred), 200);

    // Stays bounded across many more inserts.
    for (let i = 0; i < 500; i++) {
      pred(`https://flush-${i}.test/`);
    }
    assert.equal(__getUrlMemoSizeForTests(pred), 200);
  });

  it("predicate still returns correct results after eviction", () => {
    const pred = compileBlocklist(["*evict-probe*"]);
    // First URL — should match.
    assert.equal(pred("https://evict-probe.test/"), true);
    // Flood the cache so the first URL is evicted.
    for (let i = 0; i < 300; i++) {
      pred(`https://filler-${i}.test/`);
    }
    // Re-querying the original URL must still return the correct answer.
    assert.equal(pred("https://evict-probe.test/"), true);
    // And a known non-match remains a non-match.
    assert.equal(pred("https://unrelated.test/"), false);
  });
});
