import type { RouteParams } from "../router.js";
import { useLocalTrailDetail } from "../hooks/useLocalTrailDetail.js";
import MetaCard from "../components/MetaCard.js";
import EditInGraphButton from "../components/EditInGraphButton.js";
import ExportButton from "../components/ExportButton.js";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { Card } from "@ui/components/ui/card";

function formatFull(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BackLink() {
  return (
    <a
      href="#/trails"
      className="inline-flex items-center gap-1 text-[13px] text-muted-foreground no-underline transition-colors hover:text-foreground"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      back to trails
    </a>
  );
}

export default function TrailDetailPage({ params }: RouteParams) {
  const treeId = params.id;
  const { trail, isLoading, error } = useLocalTrailDetail(treeId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <BackLink />
        <Card className="items-center gap-2 py-12 px-6 border-dashed text-center">
          <p className="text-[13px] text-muted-foreground">Loading trail...</p>
        </Card>
      </div>
    );
  }

  if (error || !trail) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <BackLink />
        <Alert variant="destructive" className="border-destructive">
          <AlertDescription className="text-[13px]">
            {error ? `Failed to load trail: ${error.message}` : "Trail not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <BackLink />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {trail.rootFavicon ? (
            <img
              src={trail.rootFavicon}
              alt=""
              width={20}
              height={20}
              className="size-5 shrink-0 rounded-[3px]"
            />
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight truncate m-0">{trail.label}</h1>
        </div>
        {trail.rootTitle && <p className="text-[13px] text-muted-foreground truncate m-0">{trail.rootTitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <EditInGraphButton treeId={trail.id} />
        <ExportButton treeId={trail.id} label={trail.label} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        <MetaCard label="Nodes" value={String(trail.nodeCount)} />
        <MetaCard
          label="Root URL"
          value={trail.rootUrl ?? "\u2014"}
          href={trail.rootUrl ?? undefined}
        />
        <MetaCard label="Created" value={formatFull(trail.createdAt)} />
        <MetaCard label="Saved" value={formatFull(trail.savedAt)} />
      </div>
    </div>
  );
}
