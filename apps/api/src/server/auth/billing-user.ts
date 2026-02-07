import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { getUserById } from "@/src/server/user";

export async function getUserFromBillingBearerToken(
  token: string | null,
): Promise<Awaited<ReturnType<typeof getUserById>> | null> {
  if (!token) return null;

  const extension = verifyExtensionToken(token);
  if (extension?.sub) {
    return getUserById(extension.sub);
  }

  const userPayload = await verifyUserToken(token);
  if (!userPayload?.sub) {
    return null;
  }

  return getUserById(userPayload.sub);
}

