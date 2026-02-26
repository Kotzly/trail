import TrailLogo from "@/components/TrailLogo";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <TrailLogo animated className="h-12 w-12" label="Loading" />
    </div>
  );
}
