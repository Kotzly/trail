import { redirect } from "next/navigation";
import { auth0 } from "@/src/lib/auth0";

export default async function AccountHome() {
  const session = await auth0.getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  redirect("/auth/login");
}
