import "server-only";
import { publicEnv } from "./public-env";

function readOptionalEnv(key: string): string | null {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

export const env = {
  ...publicEnv,
  TELEGRAM_BOT_TOKEN: readOptionalEnv("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_GROUP_ID: readOptionalEnv("TELEGRAM_GROUP_ID"),
  TELEGRAM_FEATURE_TOPIC_ID: readOptionalEnv("TELEGRAM_FEATURE_TOPIC_ID"),
  TELEGRAM_FEEDBACK_TOPIC_ID: readOptionalEnv("TELEGRAM_FEEDBACK_TOPIC_ID"),
  TELEGRAM_SUPPORT_TOPIC_ID: readOptionalEnv("TELEGRAM_SUPPORT_TOPIC_ID"),
  SANITY_REVALIDATE_SECRET: readOptionalEnv("SANITY_REVALIDATE_SECRET"),
  RESEND_API_KEY: readOptionalEnv("RESEND_API_KEY"),
};
