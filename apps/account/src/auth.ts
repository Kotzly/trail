import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { jwt } from "better-auth/plugins/jwt";
import { db } from "@trail/db";
import { env } from "./env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [env.appBaseUrl],
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    // The Account app stores the JWT in an httpOnly cookie and uses it as the
    // bearer token for API calls. Keep it long-lived to avoid mid-session auth
    // failures.
    jwt({ jwt: { expirationTime: "30d" } }),
  ],
});
