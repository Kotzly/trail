import { TrailLoader } from "@trail/ui";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <TrailLoader label="Loading" />
    </div>
  );
}
