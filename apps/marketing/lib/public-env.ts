const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

if (!nextPublicAppUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_APP_URL");
}

export const publicEnv = {
  NEXT_PUBLIC_APP_URL: nextPublicAppUrl,
};
