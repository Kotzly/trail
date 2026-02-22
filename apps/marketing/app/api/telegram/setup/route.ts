import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "../../../../lib/env";
import { createForumTopic } from "../../../../lib/telegram";

const ICON_COLOR_BLUE = 0x6FB9F0;
const ICON_COLOR_GREEN = 0x8EEE98;

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

  if (env.TELEGRAM_FEATURE_TOPIC_ID && env.TELEGRAM_FEEDBACK_TOPIC_ID) {
    return NextResponse.json({
      message: "Topics already configured",
      TELEGRAM_FEATURE_TOPIC_ID: env.TELEGRAM_FEATURE_TOPIC_ID,
      TELEGRAM_FEEDBACK_TOPIC_ID: env.TELEGRAM_FEEDBACK_TOPIC_ID,
    });
  }

  try {
    const feature = await createForumTopic(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_GROUP_ID,
      "Request Feature",
      ICON_COLOR_BLUE,
    );

    const feedback = await createForumTopic(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_GROUP_ID,
      "Provide Feedback",
      ICON_COLOR_GREEN,
    );

    return NextResponse.json({
      message: "Topics created. Add these env vars to your Vercel project:",
      TELEGRAM_FEATURE_TOPIC_ID: String(feature.message_thread_id),
      TELEGRAM_FEEDBACK_TOPIC_ID: String(feedback.message_thread_id),
    });
  } catch (err) {
    console.error("Telegram setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create topics" },
      { status: 500 },
    );
  }
}
