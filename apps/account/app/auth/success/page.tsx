import Link from "next/link";

/**
 * /auth/success — shown after signing in from the extension portal.
 *
 * The extension is polling for approval in the background, so the user
 * can safely close this tab. The page shows a confirmation message.
 */
export default function AuthSuccessPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          You&apos;re all set
        </h1>
        <p className="text-sm text-muted-foreground">
          You can close this tab and return to the extension.
          <br />
          Trail will sync automatically.
        </p>
      </div>

      <Link
        href="/trails"
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        or go to your trails →
      </Link>
    </div>
  );
}
