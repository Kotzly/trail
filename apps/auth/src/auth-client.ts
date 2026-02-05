import { createAuthClient } from "better-auth/client";
import { emailOTPClient, jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), jwtClient()],
});
