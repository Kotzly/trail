import { hasRuntimeGetURL, runtimeGetURL } from '@shared/platform/webext.js';
type RuntimeDebugConfig = {
  runId: string;
  serverEndpoint: string;
  sessionId?: string | null;
};

type RuntimeLogInput = {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
};

let configPromise: Promise<RuntimeDebugConfig | null> | null = null;

async function loadRuntimeDebugConfig(): Promise<RuntimeDebugConfig | null> {
  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    if (!hasRuntimeGetURL()) {
      return null;
    }

    try {
      const url = runtimeGetURL('runtime-debug.json');
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }

      const parsed = (await response.json()) as Partial<RuntimeDebugConfig>;
      if (!parsed.runId || !parsed.serverEndpoint) {
        return null;
      }

      return {
        runId: parsed.runId,
        serverEndpoint: parsed.serverEndpoint,
        sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      };
    } catch {
      return null;
    }
  })();

  return configPromise;
}

export async function emitRuntimeLog(input: RuntimeLogInput): Promise<void> {
  const config = await loadRuntimeDebugConfig();
  if (!config) {
    return;
  }

  const payload: Record<string, unknown> = {
    runId: config.runId,
    hypothesisId: input.hypothesisId,
    location: input.location,
    message: input.message,
    data: input.data ?? {},
    timestamp: new Date().toISOString(),
  };

  if (config.sessionId) {
    payload.sessionId = config.sessionId;
  }

  try {
    await fetch(config.serverEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort logging only.
  }
}
