import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth0";

export default async function AccountHome() {
  const session = await getAuthSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  redirect("/auth/login");
}
