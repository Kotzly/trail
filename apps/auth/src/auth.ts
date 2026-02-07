import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins/email-otp";
import { jwt } from "better-auth/plugins/jwt";
import { db } from "@trail/db";
import { mailgunProvider } from "./email/mailgun";
import { env } from "./env";

const trustedOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      const provider = mailgunProvider();
      await provider.send({
        to: user.email,
        subject: "Verify your Trail email",
        text: `Open this link to verify your Trail email: ${url}`,
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        const provider = mailgunProvider();
        await provider.send({
          to: email,
          subject: "Your Trail sign-in code",
          text: `Your Trail sign-in code is ${otp}`,
        });
      },
    }),
    // The Account app stores the JWT in an httpOnly cookie and uses it as the
    // bearer token for API calls. Default 15m expiry causes users to hit
    // Unauthorized mid-session (e.g. billing checkout). Keep it long-lived.
    jwt({ jwt: { expirationTime: "30d" } }),
  ],
});
