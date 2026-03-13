import type { LocalTrailSummary } from '../hooks/useLocalTrails.js';

type TrailCardProps = {
  trail: LocalTrailSummary;
};

function formatRelative(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 0) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export default function TrailCard({ trail }: TrailCardProps) {
  return (
    <a href={`#/trails/${trail.id}`} className="trail-card">
      <div className="trail-card__header">
        <div className="trail-card__identity">
          {trail.rootFavicon ? (
            <img
              src={trail.rootFavicon}
              alt=""
              width={16}
              height={16}
              className="trail-card__favicon"
            />
          ) : (
            <span className="trail-card__favicon-placeholder" />
          )}
          <span className="trail-card__label">{trail.label}</span>
        </div>
        <span className="trail-card__badge">
          {trail.nodeCount} node{trail.nodeCount === 1 ? '' : 's'}
        </span>
      </div>

      {trail.rootTitle && (
        <p className="trail-card__title">{trail.rootTitle}</p>
      )}

      <div className="trail-card__footer">
        <time>{formatRelative(trail.savedAt)}</time>
      </div>
    </a>
  );
}
