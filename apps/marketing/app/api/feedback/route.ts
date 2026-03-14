import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "../../../lib/env";
import { sendMessage } from "../../../lib/telegram";
import { createRateLimiter } from "../../../lib/rate-limit";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_CONTACT_LENGTH = 100;

const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 3,
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (rateLimiter.isLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  if (
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_GROUP_ID ||
    !env.TELEGRAM_FEATURE_TOPIC_ID ||
    !env.TELEGRAM_FEEDBACK_TOPIC_ID ||
    !env.TELEGRAM_SUPPORT_TOPIC_ID
  ) {
    return NextResponse.json(
      { error: "Feedback is not configured yet" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, message, contact } = body as {
    type?: string;
    message?: string;
    contact?: string;
  };

  if (type !== "feature" && type !== "feedback" && type !== "support") {
    return NextResponse.json(
      { error: 'type must be "feature", "feedback", or "support"' },
      { status: 400 },
    );
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (contact && (typeof contact !== "string" || contact.length > MAX_CONTACT_LENGTH)) {
    return NextResponse.json(
      { error: `contact must be at most ${MAX_CONTACT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const threadId =
    type === "feature"
      ? Number(env.TELEGRAM_FEATURE_TOPIC_ID)
      : type === "support"
        ? Number(env.TELEGRAM_SUPPORT_TOPIC_ID)
        : Number(env.TELEGRAM_FEEDBACK_TOPIC_ID);

  const titleMap = { feature: "Feature Request", feedback: "Feedback", support: "Support Request" } as const;
  const title = titleMap[type];

  const lines = [
    `<b>${escapeHtml(title)}</b>`,
    "",
    escapeHtml(message.trim()),
  ];

  if (contact?.trim()) {
    lines.push("", `Contact: ${escapeHtml(contact.trim())}`);
  }

  lines.push("", `<i>${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</i>`);

  try {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_GROUP_ID,
      threadId,
      lines.join("\n"),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Telegram send error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
