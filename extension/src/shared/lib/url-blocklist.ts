/**
 * Shared hostname blocklist matcher. Used by the navigation handler to
 * short-circuit `shouldTrackUrl`, and by the Privacy settings UI for
 * previewing which URLs would be skipped.
 *
 * Patterns are case-insensitive hostname matchers with a single wildcard
 * token `*`:
 *   - `bank.com` — exact match
 *   - `*.bank.com` — any subdomain of bank.com (but NOT bank.com itself)
 *   - `*banking*` — any hostname containing "banking"
 *   - `*` alone — matches everything (escape hatch for "disable tracking")
 *
 * No regex evaluation on the hot path — we compile each pattern to a
 * function once and reuse.
 */

function compilePattern(pattern: string): (hostname: string) => boolean {
  const trimmed = pattern.trim().toLowerCase();
  if (trimmed.length === 0) return () => false;

  if (!trimmed.includes("*")) {
    // Exact hostname match (or "127.0.0.1" style)
    return (hostname) => hostname === trimmed;
  }

  // Translate `*` to `.*`, escape regex metacharacters otherwise.
  const regexSource = trimmed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp(`^${regexSource}$`, "i");
  return (hostname) => re.test(hostname);
}

export type CompiledBlocklist = (url: string) => boolean;

export function compileBlocklist(patterns: readonly string[]): CompiledBlocklist {
  const matchers = patterns.filter((p) => p.trim().length > 0).map(compilePattern);
  if (matchers.length === 0) return () => false;
  return (url: string) => {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }
    return matchers.some((m) => m(host));
  };
}
