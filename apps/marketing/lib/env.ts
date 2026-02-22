import "server-only";
import { publicEnv } from "./public-env";

export const env = {
  ...publicEnv,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_GROUP_ID: process.env.TELEGRAM_GROUP_ID ?? "",
  TELEGRAM_FEATURE_TOPIC_ID: process.env.TELEGRAM_FEATURE_TOPIC_ID ?? "",
  TELEGRAM_FEEDBACK_TOPIC_ID: process.env.TELEGRAM_FEEDBACK_TOPIC_ID ?? "",
  TELEGRAM_SUPPORT_TOPIC_ID: process.env.TELEGRAM_SUPPORT_TOPIC_ID ?? "",
};
