import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";

export default async function AccountHome() {
  const user = await getAccountUser();
  if (user) {
    redirect("/dashboard");
  }

  redirect("/auth/login");
}
