import { db } from "@trail/db";

type BridgeUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
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

export async function exchangeAuthBridgeCode(code: string): Promise<ExchangeResult> {
  const record = await db.authBridgeCode.findUnique({
    where: { code },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          imageUrl: true,
          createdAt: true
        }
      }
    }
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
    data: { usedAt: new Date() }
  });

  return {
    ok: true,
    user: record.user,
    jwt: updated.jwt,
    jwtExpiresAt: null
  };
}

export type { BridgeUser, ExchangeResult };
