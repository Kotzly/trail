import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { approvePortalSession } from "@/src/server/backend/portal-sessions";

function sanitizeReturnUrl(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname === "/auth/portal/complete") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildLoginReturnTo(portalId: string, returnUrl: string | null): string {
  const target = new URL("http://localhost/auth/portal/complete");
  target.searchParams.set("portal", portalId);
  if (returnUrl) {
    target.searchParams.set("returnUrl", returnUrl);
  }
  return `${target.pathname}${target.search}`;
}

export default async function PortalCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string; returnUrl?: string }>;
}) {
  const { portal, returnUrl } = await searchParams;
  const portalId = typeof portal === "string" ? portal.trim() : "";
  const safeReturnUrl = sanitizeReturnUrl(returnUrl);

  if (!portalId) {
    return (
      <section className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">Portal session not found</h1>
        <p className="text-sm text-muted-foreground">
          Missing portal id. Start sign-in from the extension again.
        </p>
      </section>
    );
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: new Headers(requestHeaders),
  });

  if (!session?.user?.id) {
    const returnTo = buildLoginReturnTo(portalId, safeReturnUrl);
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const approval = await approvePortalSession(portalId, session.user.id);
  if (!approval.ok) {
    return (
      <section className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">Sign-in link expired</h1>
        <p className="text-sm text-muted-foreground">
          Start sign-in from the extension again.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 text-center">
      <h1 className="text-xl font-semibold">Extension connected</h1>
      <p className="text-sm text-muted-foreground">
        You can close this tab and continue in the extension.
      </p>
      {safeReturnUrl ? (
        <a
          href={safeReturnUrl}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Return to extension
        </a>
      ) : null}
    </section>
  );
}
