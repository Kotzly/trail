import { Skeleton } from "@/components/ui/skeleton";

export default function TrailsLoading() {
  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}
