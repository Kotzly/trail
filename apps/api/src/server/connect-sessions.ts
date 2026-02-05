import { db } from "@trail/db";

const CONNECT_TTL_MS = 5 * 60 * 1000;
export const CONNECT_POLL_INTERVAL_MS = 1500;

type ConnectSessionRecord = {
  id: string;
  userId: string;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type ConnectStatus =
  | { status: "pending"; session: ConnectSessionRecord }
  | { status: "expired"; session: ConnectSessionRecord }
  | { status: "approved"; session: ConnectSessionRecord };

type ApproveResult =
  | { ok: true; session: ConnectSessionRecord }
  | { ok: false; reason: "not_found" | "expired" };

function toRecord(session: {
  id: string;
  userId: string;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): ConnectSessionRecord {
  return { ...session };
}

export async function createConnectSession(userId: string) {
  const expiresAt = new Date(Date.now() + CONNECT_TTL_MS);
  const session = await db.extensionConnectSession.create({
    data: {
      userId,
      expiresAt,
    },
  });

  return toRecord(session);
}

export async function getConnectSessionStatus(
  id: string,
  userId: string,
): Promise<ConnectStatus | null> {
  const session = await db.extensionConnectSession.findUnique({
    where: { id },
  });
  if (!session || session.userId !== userId) {
    return null;
  }

  const record = toRecord(session);
  if (record.approvedAt) {
    return { status: "approved", session: record };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return { status: "expired", session: record };
  }

  return { status: "pending", session: record };
}

export async function approveConnectSession(
  id: string,
  userId: string,
): Promise<ApproveResult> {
  const session = await db.extensionConnectSession.findUnique({
    where: { id },
  });
  if (!session || session.userId !== userId) {
    return { ok: false, reason: "not_found" };
  }

  const now = new Date();
  if (!session.approvedAt && session.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (session.approvedAt) {
    return { ok: true, session: toRecord(session) };
  }

  const updated = await db.extensionConnectSession.update({
    where: { id },
    data: { approvedAt: now },
  });

  return { ok: true, session: toRecord(updated) };
}

export type { ConnectSessionRecord, ConnectStatus };
