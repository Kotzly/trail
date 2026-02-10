import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";

/**
 * /auth — login page.
 *
 * Minimal: Trail logo, headline, "Continue with Google" button.
 * If already authenticated, redirect to /trails.
 */
export default async function AuthPage() {
  const session = await getAuthSession();
  if (session?.user) {
    redirect("/trails");
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      {/* Trail fork logo */}
      <svg
        className="h-10 w-10 text-foreground"
        viewBox="0 0 188.16 188.16"
        fill="none"
        aria-label="Trail"
      >
        <g
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        >
          <path d="M53.23 43.64 C74.6 46.37 80.31 55.93 88.26 69.09" />
          <path d="M88.26 69.09 C96.21 82.27 71.21 85.9 80.28 105.61" />
          <path d="M88.26 69.09 C100.23 86.44 117.51 64.44 122.32 86.44" />
          <path d="M80.28 105.61 C92.28 112.09 98.19 122.06 99.02 134.95" />
          <path d="M122.32 86.44 C122.29 104.7 124.23 121.71 137.5 131.58" />
          <path d="M122.32 86.44 C137.9 86.53 150.02 94.53 158.69 110.44" />
        </g>
        <g fill="currentColor">
          <circle cx="53.23" cy="43.64" r="7" />
          <circle cx="88.26" cy="69.09" r="7" />
          <circle cx="122.32" cy="86.44" r="7" />
          <circle cx="80.28" cy="105.61" r="7" />
          <circle cx="99.02" cy="134.95" r="7" />
          <circle cx="137.5" cy="131.58" r="7" />
          <circle cx="158.69" cy="110.44" r="7" />
        </g>
      </svg>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Sign in to Trail
        </h1>
        <p className="text-sm text-muted-foreground">
          Map your browsing into a visual tree
        </p>
      </div>

      <Link
        href="/auth/login"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <GoogleIcon />
        Continue with Google
      </Link>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
