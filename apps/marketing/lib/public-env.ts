type PublicEnvKey = "NEXT_PUBLIC_APP_URL" | "NEXT_PUBLIC_SITE_URL";

const requirePublicEnv = (key: PublicEnvKey): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key} environment variable`);
  }
  return value;
};

export const publicEnv = {
  NEXT_PUBLIC_APP_URL: requirePublicEnv("NEXT_PUBLIC_APP_URL"),
  NEXT_PUBLIC_SITE_URL: requirePublicEnv("NEXT_PUBLIC_SITE_URL"),
};
