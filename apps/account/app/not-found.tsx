import Link from "next/link";
import TrailLogo from "@/components/TrailLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <TrailLogo animated className="h-10 w-10" label="Page not found" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">page not found</h1>
          <p className="text-sm text-muted-foreground">
            the page you are looking for does not exist.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/trails"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            go to trails
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            go home
          </Link>
        </div>
      </div>
    </div>
  );
}
