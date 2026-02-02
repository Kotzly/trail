import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins/email-otp";
import { jwtClient } from "better-auth/client/plugins/jwt";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), jwtClient()]
});
