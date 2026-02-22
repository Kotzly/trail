import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "../../../../lib/env";
import { createForumTopic } from "../../../../lib/telegram";

const ICON_COLOR_BLUE = 0x6FB9F0;
const ICON_COLOR_GREEN = 0x8EEE98;
const ICON_COLOR_PURPLE = 0xCB86DB;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.TELEGRAM_BOT_TOKEN || authHeader !== `Bearer ${env.TELEGRAM_BOT_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.TELEGRAM_GROUP_ID) {
    return NextResponse.json(
      { error: "TELEGRAM_GROUP_ID is not configured" },
      { status: 500 },
    );
  }

  const existing = {
    TELEGRAM_FEATURE_TOPIC_ID: env.TELEGRAM_FEATURE_TOPIC_ID,
    TELEGRAM_FEEDBACK_TOPIC_ID: env.TELEGRAM_FEEDBACK_TOPIC_ID,
    TELEGRAM_SUPPORT_TOPIC_ID: env.TELEGRAM_SUPPORT_TOPIC_ID,
  };

  if (existing.TELEGRAM_FEATURE_TOPIC_ID && existing.TELEGRAM_FEEDBACK_TOPIC_ID && existing.TELEGRAM_SUPPORT_TOPIC_ID) {
    return NextResponse.json({ message: "Topics already configured", ...existing });
  }

  const topics: { name: string; color: number; key: keyof typeof existing }[] = [
    { name: "Request Feature", color: ICON_COLOR_BLUE, key: "TELEGRAM_FEATURE_TOPIC_ID" },
    { name: "Provide Feedback", color: ICON_COLOR_GREEN, key: "TELEGRAM_FEEDBACK_TOPIC_ID" },
    { name: "Support", color: ICON_COLOR_PURPLE, key: "TELEGRAM_SUPPORT_TOPIC_ID" },
  ];

  try {
    const created: string[] = [];

    for (const topic of topics) {
      if (existing[topic.key]) continue;
      const result = await createForumTopic(
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_GROUP_ID,
        topic.name,
        topic.color,
      );
      existing[topic.key] = String(result.message_thread_id);
      created.push(topic.key);
    }

    return NextResponse.json({
      message: created.length
        ? `Created ${created.join(", ")}. Add these env vars to your Vercel project:`
        : "Topics already configured",
      ...existing,
    });
  } catch (err) {
    console.error("Telegram setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create topics" },
      { status: 500 },
    );
  }
}
