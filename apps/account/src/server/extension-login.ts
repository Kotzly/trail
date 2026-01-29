import { internalApiJson } from "@/src/server/internal-api";

export async function createExtensionLoginCode(userId: string, preferredCode?: string) {
  const { code } = await internalApiJson<{ code: string }>(
    "/api/internal/extension/login-code",
    {
      method: "POST",
      body: { userId, preferredCode }
    }
  );

  return code;
}
