import { db } from "@trail/db";
import { createExtensionToken } from "./auth/extension-auth";

const PORTAL_TTL_MS = 5 * 60 * 1000;
export const PORTAL_POLL_INTERVAL_MS = 1500;

type PortalSessionInput = {
  source?: string | null;
  locale?: string | null;
  returnUrl?: string | null;
};

type PortalSessionRecord = {
  id: string;
  source: string | null;
  locale: string | null;
  returnUrl: string | null;
  userId: string | null;
  extensionToken: string | null;
  extensionTokenExpiresAt: Date | null;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type PortalUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
  onboardingSeenAt: Date | null;
};

type PortalSessionStatus =
  | { status: "pending"; session: PortalSessionRecord }
  | { status: "expired"; session: PortalSessionRecord }
  | {
      status: "approved";
      session: PortalSessionRecord;
      user: PortalUser | null;
    };

type ApproveResult =
  | { ok: true; session: PortalSessionRecord }
  | { ok: false; reason: "not_found" | "expired" };

function toRecord(session: {
  id: string;
  source: string | null;
  locale: string | null;
  returnUrl: string | null;
  userId: string | null;
  extensionToken: string | null;
  extensionTokenExpiresAt: Date | null;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): PortalSessionRecord {
  return { ...session };
}

export async function createPortalSession(input: PortalSessionInput) {
  const expiresAt = new Date(Date.now() + PORTAL_TTL_MS);
  const session = await db.portalSession.create({
    data: {
      source: input.source ?? null,
      locale: input.locale ?? null,
      returnUrl: input.returnUrl ?? null,
      expiresAt,
    },
  });

  return toRecord(session);
}

export async function getPortalSessionStatus(
  id: string,
): Promise<PortalSessionStatus | null> {
  const session = await db.portalSession.findUnique({
    where: { id },
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

  if (!session) {
    return null;
  }

  const record = toRecord(session);
  if (record.approvedAt) {
    return { status: "approved", session: record, user: session.user ?? null };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return { status: "expired", session: record };
  }

  return { status: "pending", session: record };
}

export async function approvePortalSession(
  id: string,
  userId: string,
): Promise<ApproveResult> {
  const session = await db.portalSession.findUnique({ where: { id } });
  if (!session) {
    return { ok: false, reason: "not_found" };
  }

  const now = new Date();
  if (!session.approvedAt && session.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (session.approvedAt) {
    return { ok: true, session: toRecord(session) };
  }

  const token = createExtensionToken(userId);
  const updated = await db.portalSession.update({
    where: { id },
    data: {
      userId,
      approvedAt: now,
      extensionToken: token.token,
      extensionTokenExpiresAt: new Date(token.expiresAt),
    },
  });

  return { ok: true, session: toRecord(updated) };
}

export type { PortalSessionRecord, PortalSessionStatus, PortalUser };
