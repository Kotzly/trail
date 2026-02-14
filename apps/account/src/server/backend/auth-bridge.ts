import { randomUUID } from "crypto";
import { db } from "@trail/db";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserById } from "@/src/server/backend/user";

const AUTH_BRIDGE_CODE_TTL_MINUTES = 10;

type BridgeUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
  onboardingSeenAt: Date | null;
};

type ExchangeSuccess = {
  ok: true;
  user: BridgeUser;
  jwt: string;
  jwtExpiresAt: Date | null;
};

type ExchangeFailure = {
  ok: false;
  reason: "not_found" | "expired" | "used";
};

type ExchangeResult = ExchangeSuccess | ExchangeFailure;

type CreateFromExtensionSuccess = {
  ok: true;
  code: string;
  expiresAt: Date;
};

type CreateFromExtensionFailure = {
  ok: false;
  reason: "unauthorized" | "user_not_found";
};

type CreateFromExtensionResult =
  | CreateFromExtensionSuccess
  | CreateFromExtensionFailure;

async function createAuthBridgeCode(
  userId: string,
  jwt: string,
): Promise<{ code: string; expiresAt: Date }> {
  const code = randomUUID();
  const expiresAt = new Date(
    Date.now() + AUTH_BRIDGE_CODE_TTL_MINUTES * 60 * 1000,
  );

  await db.authBridgeCode.create({
    data: {
      code,
      userId,
      jwt,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function exchangeAuthBridgeCode(
  code: string,
): Promise<ExchangeResult> {
  const record = await db.authBridgeCode.findUnique({
    where: { code },
    include: {
      user: {
        select: {
      id: true,
      email: true,
      name: true,
      imageUrl: true,
      createdAt: true,
      onboardingSeenAt: true,
        },
      },
    },
  });

  if (!record) {
    return { ok: false, reason: "not_found" };
  }

  if (record.usedAt) {
    return { ok: false, reason: "used" };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const updated = await db.authBridgeCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return {
    ok: true,
    user: record.user,
    jwt: updated.jwt,
    jwtExpiresAt: null,
  };
}

export type { BridgeUser, ExchangeResult };

export async function createAuthBridgeCodeFromExtensionToken(
  token: string,
): Promise<CreateFromExtensionResult> {
  const extensionUser = await verifyExtensionToken(token);
  if (!extensionUser?.sub) {
    return { ok: false, reason: "unauthorized" };
  }

  const user = await getUserById(extensionUser.sub);
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const created = await createAuthBridgeCode(user.id, token);
  return { ok: true, code: created.code, expiresAt: created.expiresAt };
}

export type { CreateFromExtensionResult };
