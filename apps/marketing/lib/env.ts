import "server-only";
import { publicEnv } from "./public-env";

type ServerEnvKey = "WAITLIST_PROVIDER_ENDPOINT" | "WAITLIST_PROVIDER_TOKEN";

const requireEnv = (key: ServerEnvKey): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key} environment variable`);
  }
  return value;
};

export const env = {
  ...publicEnv,
  WAITLIST_PROVIDER_ENDPOINT: requireEnv("WAITLIST_PROVIDER_ENDPOINT"),
  WAITLIST_PROVIDER_TOKEN: requireEnv("WAITLIST_PROVIDER_TOKEN"),
};
