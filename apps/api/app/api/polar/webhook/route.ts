import { NextResponse } from "next/server";
import { db } from "@trail/db";
import {
  getStandardWebhookHeaders,
  verifyStandardWebhookSignature,
  WebhookVerificationError
} from "../../../../src/server/polar/standard-webhooks";
import { syncSubscriptionFromPolarWebhook } from "../../../../src/server/polar/subscription-sync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Missing POLAR_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const rawBody = await req.text();

  let headers;
  try {
    headers = getStandardWebhookHeaders(req.headers);
    verifyStandardWebhookSignature({ headers, rawBody, secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    const status = err instanceof WebhookVerificationError ? 400 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const eventType =
    typeof (payload as any)?.type === "string" ? (payload as any).type : "unknown";

  // Idempotency + retries:
  // - we store webhook-id as the primary key
  // - we only mark PROCESSED after subscription state was persisted
  // - FAILED events can be retried (Polar will retry 5xx)
  await db.polarWebhookEvent.upsert({
    where: { id: headers.id },
    update: {
      type: eventType,
      payload: payload as any
    },
    create: {
      id: headers.id,
      type: eventType,
      payload: payload as any
    }
  });

  // Try to claim processing.
  const claimed = await db.polarWebhookEvent.updateMany({
    where: {
      id: headers.id,
      status: { in: ["PENDING", "FAILED"] }
    },
    data: {
      status: "PROCESSING",
      error: null
    }
  });

  if (claimed.count === 0) {
    const existing = await db.polarWebhookEvent.findUnique({
      where: { id: headers.id }
    });

    if (existing?.status === "PROCESSED") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Another worker is currently processing this message.
    return NextResponse.json({ ok: true, inProgress: true });
  }

  try {
    const update = await syncSubscriptionFromPolarWebhook({ eventType, payload });

    await db.polarWebhookEvent.update({
      where: { id: headers.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        error: null
      }
    });

    return NextResponse.json({ ok: true, update });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await db.polarWebhookEvent.update({
      where: { id: headers.id },
      data: {
        status: "FAILED",
        error: message
      }
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
