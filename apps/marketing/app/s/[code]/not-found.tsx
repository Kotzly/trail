import Link from "next/link";
import { Button } from "@/app/components/ui/button";

/**
 * Rendered when `get_shared_trail` returns null — link missing,
 * revoked, or otherwise unavailable. The viewer doesn't distinguish
 * between these states (single 404 surface) so the share-code
 * existence isn't leaked to anonymous visitors.
 */
export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This trail isn&apos;t available
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The link has been revoked or never existed. If someone shared this
          with you, ask them to send a fresh link.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">Visit Trail</Link>
        </Button>
      </div>
    </main>
  );
}
