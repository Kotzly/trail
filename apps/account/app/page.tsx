import { redirect } from "next/navigation";
import {
  getAuthTokenFromCookies,
  getAuthUserFromToken,
  getDevUser,
  isAuthBypassed
} from "@/src/lib/auth";

async function getAccountUser() {
  if (isAuthBypassed()) {
    return getDevUser();
  }

  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  return getAuthUserFromToken(token);
}

export default async function AccountHome() {
  const user = await getAccountUser();
  if (user) {
    redirect("/dashboard");
  }

  redirect("/auth/login");
}
