import assert from 'node:assert/strict';
import { WEBSITE_MESSAGE } from '../src/shared/transport/protocols.js';
import {
  registerWebsiteBridgeRuntime,
  type WebsiteBridgeRuntime,
} from '../src/content/bridge/register-runtime.js';

type MessageHandler<TData, TResult> = (message: { data: TData }) => TResult | Promise<TResult>;

function createRegistrar() {
  const handlers = new Map<string, MessageHandler<unknown, unknown>>();
  return {
    handlers,
    register<TData, TResult>(type: string, handler: MessageHandler<TData, TResult>) {
      handlers.set(type, handler as MessageHandler<unknown, unknown>);
    },
  };
}

async function testRuntimeRegistration(): Promise<void> {
  const websiteRegistrar = createRegistrar();
  const extensionRegistrar = createRegistrar();
  const calls: string[] = [];

  const websiteBridge: WebsiteBridgeRuntime = {
    async ping() {
      calls.push('ping');
      return { version: '1.2.3', authenticated: false };
    },
    async openPanel() {
      calls.push('open-panel');
    },
  };

  registerWebsiteBridgeRuntime({
    websiteBridge,
    onWebsiteMessage: websiteRegistrar.register,
    onExtensionMessage: extensionRegistrar.register,
  });

  assert.deepEqual([...websiteRegistrar.handlers.keys()], [
    WEBSITE_MESSAGE.PING,
    WEBSITE_MESSAGE.OPEN_PANEL,
  ]);
  assert.deepEqual([...extensionRegistrar.handlers.keys()], []);

  const ping = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.PING);
  const openPanel = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.OPEN_PANEL);

  assert(ping, 'ping handler must be registered');
  assert(openPanel, 'open panel handler must be registered');

  assert.deepEqual(await ping({ data: undefined }), {
    version: '1.2.3',
    authenticated: false,
  });
  await openPanel({ data: undefined });

  assert.deepEqual(calls, ['ping', 'open-panel']);

  console.log('  website bridge runtime registration: OK');
}

async function run(): Promise<void> {
  console.log('Running content-bridge-runtime.test.ts...');
  await testRuntimeRegistration();
}

void run().then(() => {
  console.log('content-bridge-runtime.test.ts passed');
});
