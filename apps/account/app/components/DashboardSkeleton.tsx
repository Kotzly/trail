import { Skeleton } from "./ui/Skeleton";

export function DashboardSkeleton() {
  return (
    <section className="space-y-8">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Row Skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-surface/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="rounded-[28px] border border-border/60 bg-surface/80 px-8 py-12">
        <div className="mx-auto max-w-md space-y-6">
          <Skeleton className="mx-auto h-16 w-16 rounded-2xl" />
          <Skeleton className="mx-auto h-6 w-32" />
          <Skeleton className="mx-auto h-4 w-64" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </div>
      </div>

      {/* Quick Links Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-surface/60 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
