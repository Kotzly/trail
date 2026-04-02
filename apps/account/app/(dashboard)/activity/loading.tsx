import { Skeleton } from "@/components/ui/skeleton";

function SkeletonDay() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-2 pl-4 border-l border-border ml-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-1">
            <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ActivityLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonDay key={i} />
        ))}
      </div>
    </div>
  );
}
