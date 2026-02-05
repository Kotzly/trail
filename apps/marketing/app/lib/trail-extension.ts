const SITE_MESSAGE_SOURCE = "trail-site" as const;
const EXTENSION_MESSAGE_SOURCE = "trail-extension" as const;
const OPEN_TRAIL_PANEL = "OPEN_TRAIL_PANEL" as const;
const OPEN_TRAIL_PANEL_ACK = "OPEN_TRAIL_PANEL_ACK" as const;

export type OpenTrailPanelResult = {
  ok: boolean;
  error?: string;
};

export type OpenTrailPanelOptions = {
  timeoutMs?: number;
};

type OpenTrailPanelAck = {
  source?: typeof EXTENSION_MESSAGE_SOURCE;
  type?: typeof OPEN_TRAIL_PANEL_ACK;
  requestId?: string;
  ok?: boolean;
  error?: string;
};

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function openTrailPanel(
  options?: OpenTrailPanelOptions,
): Promise<OpenTrailPanelResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, error: "window is not available" });
  }

  const timeoutMs = options?.timeoutMs ?? 900;

  return new Promise((resolve) => {
    const requestId = createRequestId();
    let finished = false;

    const finish = (result: OpenTrailPanelResult) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as OpenTrailPanelAck | null;
      if (!data || data.source !== EXTENSION_MESSAGE_SOURCE) return;
      if (data.type !== OPEN_TRAIL_PANEL_ACK) return;
      if (data.requestId !== requestId) return;
      finish({ ok: Boolean(data.ok), error: data.error });
    };

    const timeoutId = window.setTimeout(() => {
      finish({ ok: false, error: "timeout" });
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: SITE_MESSAGE_SOURCE, type: OPEN_TRAIL_PANEL, requestId },
      window.location.origin,
    );
  });
}
