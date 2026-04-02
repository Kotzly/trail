import { getAuthSession } from "@/src/lib/auth";
import { getTrailsList } from "@/src/server/trails";
import { Badge } from "@/components/ui/badge";
import { TrailsList } from "./trails-list";

export const metadata = {
  title: "Your Trails",
};

export default async function TrailsPage() {
  const session = await getAuthSession();
  if (!session) return null;

  const result = await getTrailsList({ limit: 50 });
  const trails = result?.items ?? [];
  const totalCount = result?.totalCount ?? 0;
  const nextCursor = result?.nextCursor ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your Trails</h1>
        {totalCount > 0 && (
          <Badge variant="secondary">{totalCount}</Badge>
        )}
      </div>
      <TrailsList
        initialTrails={trails}
        totalCount={totalCount}
        initialNextCursor={nextCursor}
      />
    </div>
  );
}
