const TRAIL_API_BASE_URL = process.env.TRAIL_API_BASE_URL;
const TRAIL_INTERNAL_API_KEY = process.env.TRAIL_INTERNAL_API_KEY;

function getInternalApiConfig() {
  if (!TRAIL_API_BASE_URL) {
    throw new Error("missing_TRAIL_API_BASE_URL");
  }
  if (!TRAIL_INTERNAL_API_KEY) {
    throw new Error("missing_TRAIL_INTERNAL_API_KEY");
  }

  return { baseUrl: TRAIL_API_BASE_URL, internalKey: TRAIL_INTERNAL_API_KEY };
}

export async function internalApiFetch(path: string, init: RequestInit = {}) {
  const { baseUrl, internalKey } = getInternalApiConfig();
  const headers = new Headers(init.headers);
  headers.set("x-trail-internal-key", internalKey);

  return fetch(new URL(path, baseUrl), {
    ...init,
    headers,
    cache: "no-store"
  });
}

type JsonInit = Omit<RequestInit, "body"> & { body?: unknown };

export async function internalApiJson<T>(path: string, init: JsonInit = {}) {
  const headers = new Headers(init.headers);
  let body: BodyInit | undefined;

  if (init.body !== undefined) {
    if (typeof init.body === "string") {
      body = init.body;
    } else {
      body = JSON.stringify(init.body);
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await internalApiFetch(path, {
    ...init,
    headers,
    body
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("internal_api_error");
    (error as { status?: number; payload?: unknown }).status = response.status;
    (error as { status?: number; payload?: unknown }).payload = payload;
    throw error;
  }

  return payload as T;
}
