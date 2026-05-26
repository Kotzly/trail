/**
 * Share codes are client-minted UUID v7 values (see migration 029 and the
 * extension's `uuidv7()` mint path). Validate the shape at the read
 * boundary so `/s/<code>` rejects anything that isn't a well-formed v7
 * *before* the code is used in a DB lookup, an OG/canonical URL, or the
 * private-share OAuth `redirectTo`. Mirrors the server-side check in
 * `create_share_link` and `UUIDv7_RE` in the extension's `shared/types/ids`.
 *
 * Old base64url v4 codes minted before 029 will no longer resolve — that's
 * intentional; every live share code is a v7.
 */
const UUIDV7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidShareCode(code: string): boolean {
  return UUIDV7_RE.test(code);
}
