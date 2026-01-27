import { redirect } from "next/navigation";
import { accountCopy } from "@trail/content";
import { Card } from "@trail/ui";
import { auth0 } from "@/src/lib/auth0";
import { ensureUser } from "@/src/server/user";
import { createExtensionLoginCode } from "@/src/server/extension-login";

export const runtime = "nodejs";

type ExtensionPageProps = {
  searchParams: Promise<{
    code?: string;
  }>;
};

export default async function ExtensionPage({ searchParams }: ExtensionPageProps) {
  const session = await auth0.getSession();
  if (!session?.user) {
    redirect("/auth/login");
  }

  const user = await ensureUser(session.user);
  if (!user) {
    redirect("/auth/login");
  }

  const resolvedSearchParams = await searchParams;
  const queryCode =
    typeof resolvedSearchParams?.code === "string" ? resolvedSearchParams.code : null;
  let connectionReady = false;

  if (queryCode) {
    try {
      const stored = await createExtensionLoginCode(user.id, queryCode);
      if (stored !== queryCode) {
        redirect(`/extension?code=${stored}`);
      }
      connectionReady = true;
    } catch {
      const newCode = await createExtensionLoginCode(user.id);
      redirect(`/extension?code=${newCode}`);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{accountCopy.extension.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{accountCopy.extension.subtitle}</p>
      </div>
      <Card className="bg-surface/80">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">
          {connectionReady ? accountCopy.extension.success : "Waiting for extension"}
        </p>
        {connectionReady ? (
          <>
            <p className="mt-4 text-2xl font-semibold">Connection confirmed</p>
            <p className="mt-2 text-sm text-ink-muted">{accountCopy.extension.instructions}</p>
          </>
        ) : (
          <>
            <p className="mt-4 text-lg font-semibold text-ink">
              Open the extension to finish sign-in
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Once the extension starts the login flow, this page will confirm the
              connection automatically.
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
