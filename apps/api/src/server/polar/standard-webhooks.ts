import crypto from "node:crypto";

export class WebhookVerificationError extends Error {
  name = "WebhookVerificationError";
}

type StandardWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export function getStandardWebhookHeaders(
  headers: Headers
): StandardWebhookHeaders {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");

  if (!id || !timestamp || !signature) {
    throw new WebhookVerificationError(
      "Missing Standard Webhooks headers (webhook-id / webhook-timestamp / webhook-signature)."
    );
  }

  return { id, timestamp, signature };
}

function decodeStandardWebhookSecret(secret: string): Buffer {
  // Standard Webhooks secret serialization recommends base64 secrets prefixed with `whsec_`.
  // Polar lets you set your own secret, so we support both formats.
  if (secret.startsWith("whsec_")) {
    const b64 = secret.slice("whsec_".length);
    return Buffer.from(b64, "base64");
  }

  return Buffer.from(secret, "utf8");
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyStandardWebhookSignature(params: {
  headers: StandardWebhookHeaders;
  rawBody: string;
  secret: string;
  toleranceSec?: number;
}): void {
  const { headers, rawBody, secret } = params;
  const toleranceSec = params.toleranceSec ?? 5 * 60;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) {
    throw new WebhookVerificationError("Invalid webhook-timestamp header.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSec) {
    throw new WebhookVerificationError("Webhook timestamp outside tolerance.");
  }

  const msg = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const key = decodeStandardWebhookSecret(secret);
  const expected = crypto.createHmac("sha256", key).update(msg).digest("base64");

  // Signature header is a space-delimited list of signatures.
  // Each signature is `v1,<base64>` (symmetric) or `v1a,<base64>` (asymmetric).
  // We only support `v1` here.
  const signatures = headers.signature.split(" ").filter(Boolean);

  for (const entry of signatures) {
    const [version, sig] = entry.split(",", 2);
    if (!version || !sig) continue;
    if (version !== "v1") continue;

    if (timingSafeEqualString(sig, expected)) {
      return;
    }
  }

  throw new WebhookVerificationError("Invalid webhook signature.");
}
