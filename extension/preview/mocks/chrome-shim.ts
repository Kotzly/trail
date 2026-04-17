// Minimal globalThis.chrome polyfill for the preview harness.
// Loaded BEFORE any sidepanel code so `wxt/browser` resolves without crashing.

const storage = new Map<string, unknown>();

const noop = () => {};
const asyncNoop = async () => {};

const chromeStub = {
  runtime: {
    id: "preview",
    lastError: undefined,
    getManifest: () => ({ version: "0.0.0-preview" }),
    getURL: (p: string) => `${location.origin}/${p.replace(/^\/+/, "")}`,
    connect: () => ({
      name: "preview",
      postMessage: noop,
      disconnect: noop,
      onMessage: { addListener: noop, removeListener: noop },
      onDisconnect: { addListener: noop, removeListener: noop },
    }),
    sendMessage: asyncNoop,
    onMessage: { addListener: noop, removeListener: noop, hasListener: () => false },
    onConnect: { addListener: noop, removeListener: noop },
  },
  storage: {
    local: {
      get: async (keys: string | string[] | null) => {
        if (!keys) return Object.fromEntries(storage.entries());
        const list = Array.isArray(keys) ? keys : [keys];
        const out: Record<string, unknown> = {};
        list.forEach((k) => {
          if (storage.has(k)) out[k] = storage.get(k);
        });
        return out;
      },
      set: async (items: Record<string, unknown>) => {
        Object.entries(items).forEach(([k, v]) => storage.set(k, v));
      },
      remove: async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((k) => storage.delete(k));
      },
      clear: async () => storage.clear(),
    },
    session: {
      get: async () => ({}),
      set: asyncNoop,
      remove: asyncNoop,
      clear: asyncNoop,
    },
    onChanged: { addListener: noop, removeListener: noop },
  },
  tabs: {
    get: async (id: number) => ({
      id,
      title: `Preview tab ${id}`,
      url: "about:blank",
      mutedInfo: { muted: false, reason: "user" },
    }),
    update: async () => ({}),
    create: async () => ({}),
    remove: asyncNoop,
    query: async () => [],
    onCreated: { addListener: noop, removeListener: noop },
    onUpdated: { addListener: noop, removeListener: noop },
    onRemoved: { addListener: noop, removeListener: noop },
    onActivated: { addListener: noop, removeListener: noop },
  },
  windows: {
    onFocusChanged: { addListener: noop, removeListener: noop },
    WINDOW_ID_NONE: -1,
  },
  sidePanel: {
    setOptions: asyncNoop,
    open: asyncNoop,
  },
  action: {
    onClicked: { addListener: noop, removeListener: noop },
  },
  alarms: {
    create: noop,
    clear: asyncNoop,
    onAlarm: { addListener: noop, removeListener: noop },
  },
  identity: {
    getAuthToken: async () => ({ token: "" }),
    launchWebAuthFlow: asyncNoop,
  },
  i18n: {
    getMessage: (k: string) => k,
    getUILanguage: () => "en",
  },
};

// Install early so any module that touches globalThis.chrome during import
// (e.g. wxt/browser, @webext-core/*) sees a populated stub.
(globalThis as unknown as { chrome: typeof chromeStub; browser: typeof chromeStub }).chrome =
  chromeStub;
(globalThis as unknown as { chrome: typeof chromeStub; browser: typeof chromeStub }).browser =
  chromeStub;

export {};
