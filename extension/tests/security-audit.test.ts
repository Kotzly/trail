import assert from 'node:assert/strict';

import {
  SiteMessage,
  SITE_SOURCE,
  SiteMessageType,
  MESSAGE_TTL_MS,
} from '../src/shared/schemas/site-messages.js';
import { isAllowedSiteOrigin } from '../src/shared/config/site-origins.js';
import {
  resolveBackendConfig,
  resolvePresetOverride,
} from '../src/shared/config/backend.js';

// ---------------------------------------------------------------------------
// Site message schema validation
// ---------------------------------------------------------------------------

function testSiteMessageRejectsInvalidSource(): void {
  const result = SiteMessage.safeParse({
    source: 'evil-source',
    type: 'PING',
    requestId: '11111111-1111-4111-8111-111111111111',
    timestamp: Date.now(),
  });
  assert.equal(result.success, false);
}

function testSiteMessageRejectsUnknownType(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: 'EXECUTE_ARBITRARY_CODE',
    requestId: '11111111-1111-4111-8111-111111111111',
    timestamp: Date.now(),
  });
  assert.equal(result.success, false);
}

function testSiteMessageRejectsMissingRequestId(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: 'PING',
    timestamp: Date.now(),
  });
  assert.equal(result.success, false);
}

function testSiteMessageRejectsNonUuidRequestId(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: 'PING',
    requestId: 'not-a-uuid',
    timestamp: Date.now(),
  });
  assert.equal(result.success, false);
}

function testSiteMessageRejectsMissingTimestamp(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: 'PING',
    requestId: '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(result.success, false);
}

function testSiteMessageAcceptsValidPing(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: SiteMessageType.PING,
    requestId: '11111111-1111-4111-8111-111111111111',
    timestamp: Date.now(),
  });
  assert.equal(result.success, true);
}

function testSiteMessageAcceptsAuthCodeRelay(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: SiteMessageType.AUTH_CODE_RELAY,
    requestId: '22222222-2222-4222-8222-222222222222',
    timestamp: Date.now(),
    code: 'auth-code-123',
    codeVerifier: 'verifier-abc',
    redirectUri: 'https://gettrail.net/auth/callback',
  });
  assert.equal(result.success, true);
}

function testSiteMessageAuthCodeRelayRequiresFields(): void {
  const result = SiteMessage.safeParse({
    source: SITE_SOURCE,
    type: SiteMessageType.AUTH_CODE_RELAY,
    requestId: '22222222-2222-4222-8222-222222222222',
    timestamp: Date.now(),
    // Missing code, codeVerifier, redirectUri
  });
  assert.equal(result.success, false);
}

function testMessageTtlConstant(): void {
  assert.equal(MESSAGE_TTL_MS, 30_000);
}

// ---------------------------------------------------------------------------
// Origin allowlist security
// ---------------------------------------------------------------------------

function testOriginRejectsArbitraryDomains(): void {
  assert.equal(isAllowedSiteOrigin('https://evil.com'), false);
  assert.equal(isAllowedSiteOrigin('https://gettrail.net.evil.com'), false);
  assert.equal(isAllowedSiteOrigin('https://fake-gettrail.net'), false);
  assert.equal(isAllowedSiteOrigin(''), false);
  assert.equal(isAllowedSiteOrigin('null'), false);
  assert.equal(isAllowedSiteOrigin('file:///etc/passwd'), false);
}

function testOriginRejectsSubdomainSpoofing(): void {
  assert.equal(isAllowedSiteOrigin('https://app.gettrail.net.attacker.com'), false);
  assert.equal(isAllowedSiteOrigin('https://xapp.gettrail.net'), false);
}

function testOriginAcceptsProductionDomains(): void {
  assert.equal(isAllowedSiteOrigin('https://gettrail.net'), true);
  assert.equal(isAllowedSiteOrigin('https://app.gettrail.net'), true);
}

// ---------------------------------------------------------------------------
// Backend config injection prevention
// ---------------------------------------------------------------------------

function testBackendConfigRejectsJavascriptUrl(): void {
  const config = resolveBackendConfig({
    baseUrl: 'javascript:alert(1)',
  });
  // Should fall back to default because javascript: is not a valid base URL
  // (it lacks // authority). resolveBackendConfig normalizes it.
  assert.ok(!config.baseUrl.startsWith('javascript:'));
}

function testBackendConfigNormalizesEmptyOverride(): void {
  const config = resolveBackendConfig(null);
  assert.equal(config.baseUrl, 'https://app.gettrail.net');
  assert.equal(config.env, 'production');
}

function testBackendConfigRejectsUnknownPreset(): void {
  const override = resolvePresetOverride('drop-tables');
  assert.equal(override, null);
}

function testBackendConfigRejectsPrototypePollution(): void {
  const config = resolveBackendConfig({
    baseUrl: 'https://evil.com',
    env: '__proto__' as 'production',
  });
  // Unknown env should fall back to default
  assert.equal(config.env, 'production');
}

// ---------------------------------------------------------------------------
// Export runner
// ---------------------------------------------------------------------------

export function runSecurityAuditTests(): void {
  testSiteMessageRejectsInvalidSource();
  testSiteMessageRejectsUnknownType();
  testSiteMessageRejectsMissingRequestId();
  testSiteMessageRejectsNonUuidRequestId();
  testSiteMessageRejectsMissingTimestamp();
  testSiteMessageAcceptsValidPing();
  testSiteMessageAcceptsAuthCodeRelay();
  testSiteMessageAuthCodeRelayRequiresFields();
  testMessageTtlConstant();
  testOriginRejectsArbitraryDomains();
  testOriginRejectsSubdomainSpoofing();
  testOriginAcceptsProductionDomains();
  testBackendConfigRejectsJavascriptUrl();
  testBackendConfigNormalizesEmptyOverride();
  testBackendConfigRejectsUnknownPreset();
  testBackendConfigRejectsPrototypePollution();
}
