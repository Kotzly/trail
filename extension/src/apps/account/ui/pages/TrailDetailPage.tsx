import type { RouteParams } from "../router.js";
import { useLocalTrailDetail } from "../hooks/useLocalTrailDetail.js";
import MetaCard from "../components/MetaCard.js";
import EditInGraphButton from "../components/EditInGraphButton.js";
import ExportButton from "../components/ExportButton.js";

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

export default function TrailDetailPage({ params }: RouteParams) {
  const treeId = params.id;
  const { trail, isLoading, error } = useLocalTrailDetail(treeId);

  if (isLoading) {
    return (
      <div className="account-page">
        <a href="#/trails" className="account-back-link">
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
        <div className="account-empty">
          <p className="account-empty__text">Loading trail...</p>
        </div>
      </div>
    );
  }

  if (error || !trail) {
    return (
      <div className="account-page">
        <a href="#/trails" className="account-back-link">
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
        <div className="account-error">
          <p className="account-error__text">
            {error ? `Failed to load trail: ${error.message}` : "Trail not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <a href="#/trails" className="account-back-link">
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

      <div className="trail-detail__header">
        <div className="trail-detail__identity">
          {trail.rootFavicon ? (
            <img
              src={trail.rootFavicon}
              alt=""
              width={20}
              height={20}
              className="trail-detail__favicon"
            />
          ) : null}
          <h1 className="trail-detail__label">{trail.label}</h1>
        </div>
        {trail.rootTitle && <p className="trail-detail__root-title">{trail.rootTitle}</p>}
      </div>

      <div className="trail-detail__actions">
        <EditInGraphButton treeId={trail.id} />
        <ExportButton treeId={trail.id} label={trail.label} />
      </div>

      <div className="meta-grid">
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
