import { internalApiJson } from "@/src/server/internal-api";

export type AccountConfigValue = boolean | number | string | null;
export type AccountConfig = Record<string, AccountConfigValue>;

type InternalExtensionConfig = {
  config?: unknown;
};

function normalizeConfig(input: unknown): AccountConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result: AccountConfig = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key) continue;
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      result[key] = value;
    }
  }

  return result;
}

export async function getExtensionConfig(): Promise<AccountConfig> {
  try {
    const response = await internalApiJson<InternalExtensionConfig>(
      "/api/internal/extension/config",
      { method: "GET" },
    );
    return normalizeConfig(response?.config);
  } catch {
    return {};
  }
}
