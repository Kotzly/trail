import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";

export default async function AccountHome() {
  const session = await getAuthSession();
  if (session?.user) {
    redirect("/trails");
  }

  redirect("/auth/callback");
}
