import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { resolveSafeNextPath } from "@/src/server/auth-redirect";
import { LoginCard } from "./login-card";

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo } = await searchParams;
  const safeReturnTo = resolveSafeNextPath(returnTo, "/trails");

  const session = await getAuthSession();
  if (session) {
    redirect(safeReturnTo);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4">
      <LoginCard returnTo={safeReturnTo} />
    </main>
  );
}
