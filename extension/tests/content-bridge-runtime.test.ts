import assert from 'node:assert/strict';
import {
  EXTENSION_MESSAGE,
  WEBSITE_MESSAGE,
} from '../src/shared/transport/protocols.js';
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
      return { version: '1.2.3', authenticated: false, editorMode: true };
    },
    async openPanel() {
      calls.push('open-panel');
    },
    async enterEditorMode(treeId) {
      calls.push(`enter:${treeId}`);
      return { active: true, treeId };
    },
    async exitEditorMode() {
      calls.push('exit');
      return { active: false, treeId: null };
    },
    async saveEditorMode() {
      calls.push('save');
    },
    async cancelEditorMode() {
      calls.push('cancel');
    },
    handleEditorModeExited(payload) {
      calls.push(`relayed:${String(payload.editorMode)}`);
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
    WEBSITE_MESSAGE.ENTER_EDITOR_MODE,
    WEBSITE_MESSAGE.EXIT_EDITOR_MODE,
    WEBSITE_MESSAGE.SAVE_EDITOR_MODE,
    WEBSITE_MESSAGE.CANCEL_EDITOR_MODE,
  ]);
  assert.deepEqual([...extensionRegistrar.handlers.keys()], [
    EXTENSION_MESSAGE.SITE_EDITOR_MODE_EXITED,
  ]);

  const ping = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.PING);
  const openPanel = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.OPEN_PANEL);
  const enterEditorMode = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.ENTER_EDITOR_MODE);
  const exitEditorMode = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.EXIT_EDITOR_MODE);
  const saveEditorMode = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.SAVE_EDITOR_MODE);
  const cancelEditorMode = websiteRegistrar.handlers.get(WEBSITE_MESSAGE.CANCEL_EDITOR_MODE);
  const editorModeExited = extensionRegistrar.handlers.get(EXTENSION_MESSAGE.SITE_EDITOR_MODE_EXITED);

  assert(ping, 'ping handler must be registered');
  assert(openPanel, 'open panel handler must be registered');
  assert(enterEditorMode, 'enter editor mode handler must be registered');
  assert(exitEditorMode, 'exit editor mode handler must be registered');
  assert(saveEditorMode, 'save editor mode handler must be registered');
  assert(cancelEditorMode, 'cancel editor mode handler must be registered');
  assert(editorModeExited, 'editor exit relay handler must be registered');

  assert.deepEqual(await ping({ data: undefined }), {
    version: '1.2.3',
    authenticated: false,
    editorMode: true,
  });
  await openPanel({ data: undefined });
  assert.deepEqual(await enterEditorMode({ data: { treeId: 'tree-42' } }), {
    active: true,
    treeId: 'tree-42',
  });
  assert.deepEqual(await exitEditorMode({ data: undefined }), {
    active: false,
    treeId: null,
  });
  await saveEditorMode({ data: undefined });
  await cancelEditorMode({ data: undefined });
  await editorModeExited({ data: { editorMode: false } });

  assert.deepEqual(calls, [
    'ping',
    'open-panel',
    'enter:tree-42',
    'exit',
    'save',
    'cancel',
    'relayed:false',
  ]);

  console.log('  website bridge runtime registration: OK');
}

async function run(): Promise<void> {
  console.log('Running content-bridge-runtime.test.ts...');
  await testRuntimeRegistration();
}

void run().then(() => {
  console.log('content-bridge-runtime.test.ts passed');
});
