import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { getUserById } from "@/src/server/backend/user";

export async function getUserFromBillingBearerToken(
  token: string | null,
): Promise<Awaited<ReturnType<typeof getUserById>> | null> {
  if (!token) return null;

  const extension = await verifyExtensionToken(token);
  if (extension?.sub) {
    return getUserById(extension.sub);
  }

  const userPayload = await verifyUserToken(token);
  if (!userPayload?.sub) {
    return null;
  }

  return getUserById(userPayload.sub);
}
