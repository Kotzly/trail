import { TrailLoader } from "@trail/ui";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <TrailLoader label="Loading" />
      <div className="text-xs text-ink-muted">
        <a className="underline underline-offset-4" href="https://www.gettrail.net/privacy">
          Privacy Policy
        </a>
      </div>
    </div>
  );
}
