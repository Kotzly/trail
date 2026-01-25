import { redirect } from "next/navigation";
import { accountCopy } from "@trail/content";
import { Card } from "@trail/ui";
import { auth0 } from "@/src/lib/auth0";
import { db } from "@trail/db";
import { ensureUser } from "@/src/server/user";
import { createExtensionLoginCode } from "@/src/server/extension-login";

type ExtensionPageProps = {
  searchParams: {
    code?: string;
  };
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

  const queryCode = typeof searchParams.code === "string" ? searchParams.code : null;
  const now = new Date();

  if (queryCode) {
    const existing = await db.extensionLoginCode.findUnique({ where: { code: queryCode } });
    if (!existing || existing.usedAt || existing.expiresAt < now) {
      const newCode = await createExtensionLoginCode(user.id);
      redirect(`/extension?code=${newCode}`);
    }
  } else {
    const newCode = await createExtensionLoginCode(user.id);
    redirect(`/extension?code=${newCode}`);
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{accountCopy.extension.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{accountCopy.extension.subtitle}</p>
      </div>
      <Card className="bg-surface/80">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">
          {accountCopy.extension.success}
        </p>
        <p className="mt-4 text-2xl font-semibold">{queryCode}</p>
        <p className="mt-2 text-sm text-ink-muted">{accountCopy.extension.instructions}</p>
      </Card>
    </section>
  );
}
