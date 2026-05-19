import assert from 'node:assert/strict';
import type {
  TitleOrFaviconChangedInput,
  TreeUpdatedInput,
  UiNotificationInput,
} from '../src/shared/rpc/contracts.js';
import {
  ACTION_SERVICE_KEY,
  COMMAND_SERVICE_KEY,
  FLAGS_SERVICE_KEY,
  SETTINGS_SERVICE_KEY,
  TABS_SERVICE_KEY,
  TREE_SERVICE_KEY,
} from '../src/shared/transport/proxy-services.js';
import {
  EXTENSION_MESSAGE,
  WEBSITE_MESSAGE,
  WEBSITE_MESSAGING_NAMESPACE,
  type ExtensionProtocolMap,
  type WebsiteProtocolMap,
} from '../src/shared/transport/protocols.js';

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type _ExtensionOpenPanel = Expect<
  Equal<Parameters<ExtensionProtocolMap[typeof EXTENSION_MESSAGE.OPEN_PANEL]>, []>
>;
type _ExtensionTitleChanged = Expect<
  Equal<
    Parameters<ExtensionProtocolMap[typeof EXTENSION_MESSAGE.TITLE_OR_FAVICON_CHANGED]>,
    [TitleOrFaviconChangedInput]
  >
>;
type _ExtensionTreeUpdated = Expect<
  Equal<Parameters<ExtensionProtocolMap[typeof EXTENSION_MESSAGE.TREE_UPDATED]>, [TreeUpdatedInput]>
>;
type _ExtensionUiNotify = Expect<
  Equal<Parameters<ExtensionProtocolMap[typeof EXTENSION_MESSAGE.UI_NOTIFY]>, [UiNotificationInput]>
>;
type _WebsitePing = Expect<Equal<Parameters<WebsiteProtocolMap[typeof WEBSITE_MESSAGE.PING]>, []>>;

function testProtocolConstants(): void {
  assert.equal(WEBSITE_MESSAGING_NAMESPACE, 'trail-bridge-v1');

  assert.deepEqual(Object.values(EXTENSION_MESSAGE), [
    'extension/open-panel',
    'extension/title-or-favicon-changed',
    'event/tree-updated',
    'event/trees-updated',
    'event/ui-notify',
    'event/sync-status',
    'event/sync-conflict',
    'event/sync-conflict-resolved',
    'event/auth-state',
    'event/auth-transition',
    'event/content-bridge-error',
    'extension/import-shared-trail-from-site',
  ]);

  assert.deepEqual(Object.values(WEBSITE_MESSAGE), [
    'site/ping',
    'site/open-panel',
    'site/import-shared-trail',
  ]);

  const extensionMessageIds = Object.values(EXTENSION_MESSAGE);
  const websiteMessageIds = Object.values(WEBSITE_MESSAGE);

  assert.equal(
    new Set(extensionMessageIds).size,
    extensionMessageIds.length,
    'extension message ids must be unique within the extension channel',
  );
  assert.equal(
    new Set(websiteMessageIds).size,
    websiteMessageIds.length,
    'website message ids must be unique within the window channel',
  );
  assert(!extensionMessageIds.includes('SITE_MESSAGE_FORWARD'), 'legacy relay message must be removed');
  assert(!websiteMessageIds.includes('trail-site'), 'legacy trail-site namespace must be removed');
  assert(!websiteMessageIds.includes('trail-extension'), 'legacy trail-extension namespace must be removed');

  console.log('  transport protocol constants: OK');
}

function testProxyServiceKeys(): void {
  assert.deepEqual(
    [
      TREE_SERVICE_KEY,
      COMMAND_SERVICE_KEY,
      SETTINGS_SERVICE_KEY,
      FLAGS_SERVICE_KEY,
      TABS_SERVICE_KEY,
      ACTION_SERVICE_KEY,
    ],
    [
      'trail/tree-service',
      'trail/command-service',
      'trail/settings-service',
      'trail/flags-service',
      'trail/tabs-service',
      'trail/action-service',
    ],
  );

  console.log('  proxy service keys: OK');
}

function run(): void {
  console.log('Running transport-contracts.test.ts...');
  testProtocolConstants();
  testProxyServiceKeys();
}

run();
console.log('transport-contracts.test.ts passed');
