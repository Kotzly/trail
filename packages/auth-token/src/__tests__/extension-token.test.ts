import assert from "node:assert/strict";
import {
  createSignedExtensionToken,
  verifySignedExtensionToken,
  DEFAULT_EXTENSION_TOKEN_TTL_SECONDS,
} from "../extension-token.js";

const TEST_SECRET = "test-secret-key-at-least-32-chars!!";
const TEST_USER_ID = "user_abc123";

// ---------------------------------------------------------------------------
// createSignedExtensionToken
// ---------------------------------------------------------------------------

function testCreateToken(): void {
  const { token, expiresAt } = createSignedExtensionToken(
    TEST_SECRET,
    TEST_USER_ID,
  );
  assert.ok(token, "token should be non-empty");
  assert.ok(expiresAt, "expiresAt should be non-empty");

  const parts = token.split(".");
  assert.equal(
    parts.length,
    3,
    "token should have 3 parts (header.payload.signature)",
  );

  // Verify expiresAt is in the future
  const expDate = new Date(expiresAt);
  assert.ok(
    expDate.getTime() > Date.now(),
    "expiresAt should be in the future",
  );

  console.log("  [PASS] createSignedExtensionToken produces valid token");
}

function testCreateTokenWithClaims(): void {
  const { token } = createSignedExtensionToken(
    TEST_SECRET,
    TEST_USER_ID,
    3600,
    {
      sid: "session_xyz",
      ver: 2,
    },
  );
  const payload = verifySignedExtensionToken(TEST_SECRET, token);
  assert.ok(payload, "token with claims should verify");
  assert.equal(payload.sid, "session_xyz");
  assert.equal(payload.ver, 2);

  console.log("  [PASS] token with optional claims (sid, ver)");
}

function testCreateTokenCustomTTL(): void {
  const ttl = 60; // 1 minute
  const { token } = createSignedExtensionToken(TEST_SECRET, TEST_USER_ID, ttl);
  const payload = verifySignedExtensionToken(TEST_SECRET, token);
  assert.ok(payload, "short-lived token should verify");
  assert.ok(payload.exp - payload.iat <= ttl + 1, "TTL should match");

  console.log("  [PASS] custom TTL respected");
}

// ---------------------------------------------------------------------------
// verifySignedExtensionToken
// ---------------------------------------------------------------------------

function testVerifyValidToken(): void {
  const { token } = createSignedExtensionToken(TEST_SECRET, TEST_USER_ID);
  const payload = verifySignedExtensionToken(TEST_SECRET, token);
  assert.ok(payload, "valid token should verify");
  assert.equal(payload.sub, TEST_USER_ID);
  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.exp, "number");
  assert.ok(payload.exp > payload.iat, "exp should be after iat");

  console.log("  [PASS] valid token verifies correctly");
}

function testVerifyWrongSecret(): void {
  const { token } = createSignedExtensionToken(TEST_SECRET, TEST_USER_ID);
  const payload = verifySignedExtensionToken(
    "wrong-secret-key-at-least-32!!",
    token,
  );
  assert.equal(payload, null, "wrong secret should return null");

  console.log("  [PASS] wrong secret rejects token");
}

function testVerifyTamperedPayload(): void {
  const { token } = createSignedExtensionToken(TEST_SECRET, TEST_USER_ID);
  const parts = token.split(".");
  // Tamper with the payload (change a character)
  const tampered =
    parts[0] + "." + parts[1]!.slice(0, -1) + "X" + "." + parts[2];
  const payload = verifySignedExtensionToken(TEST_SECRET, tampered);
  assert.equal(payload, null, "tampered payload should return null");

  console.log("  [PASS] tampered payload rejects token");
}

function testVerifyExpiredToken(): void {
  // Create a token with 0 TTL (already expired)
  const { token } = createSignedExtensionToken(TEST_SECRET, TEST_USER_ID, -1);
  const payload = verifySignedExtensionToken(TEST_SECRET, token);
  assert.equal(payload, null, "expired token should return null");

  console.log("  [PASS] expired token rejected");
}

function testVerifyMalformedToken(): void {
  assert.equal(
    verifySignedExtensionToken(TEST_SECRET, ""),
    null,
    "empty string",
  );
  assert.equal(
    verifySignedExtensionToken(TEST_SECRET, "a.b"),
    null,
    "only 2 parts",
  );
  assert.equal(
    verifySignedExtensionToken(TEST_SECRET, "a.b.c.d"),
    null,
    "4 parts",
  );
  assert.equal(
    verifySignedExtensionToken(TEST_SECRET, "not-a-jwt"),
    null,
    "no dots",
  );

  console.log("  [PASS] malformed tokens rejected");
}

function testRoundtripPreservesData(): void {
  const { token } = createSignedExtensionToken(
    TEST_SECRET,
    "user_roundtrip",
    7200,
    {
      sid: "sess_rt",
      ver: 5,
    },
  );
  const payload = verifySignedExtensionToken(TEST_SECRET, token);
  assert.ok(payload);
  assert.equal(payload.sub, "user_roundtrip");
  assert.equal(payload.sid, "sess_rt");
  assert.equal(payload.ver, 5);

  console.log("  [PASS] round-trip preserves all fields");
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------

console.log("Extension Token Tests:");
testCreateToken();
testCreateTokenWithClaims();
testCreateTokenCustomTTL();
testVerifyValidToken();
testVerifyWrongSecret();
testVerifyTamperedPayload();
testVerifyExpiredToken();
testVerifyMalformedToken();
testRoundtripPreservesData();
console.log("All extension token tests passed!");
