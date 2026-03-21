import { getTrailsList } from "@/src/server/trails";
import { TrailsClient } from "./trails-client";

export default async function TrailsPage() {
  const data = await getTrailsList({ limit: 50 });
  const trails = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Trails</h1>
        <p className="text-sm text-muted-foreground">
          {totalCount > 0
            ? `${totalCount} saved trail${totalCount === 1 ? "" : "s"}`
            : "Saved trails captured by your extension"}
        </p>
      </div>

      <TrailsClient trails={trails} />
    </section>
  );
}
