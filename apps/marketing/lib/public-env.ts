type PublicEnvKey = "NEXT_PUBLIC_APP_URL" | "NEXT_PUBLIC_SITE_URL";

const requirePublicEnv = (keys: PublicEnvKey[] | PublicEnvKey): Record<PublicEnvKey, string> | string => {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  const missing: PublicEnvKey[] = [];
  const result: Record<PublicEnvKey, string> = {} as Record<PublicEnvKey, string>;
  for (const key of keyArray) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else {
      result[key] = value;
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
  }
  return Array.isArray(keys) ? result : result[keys];
};

export const publicEnv = requirePublicEnv([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
]) as {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SITE_URL: string;
};
