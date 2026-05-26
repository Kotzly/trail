import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/app/components/ui/avatar";
import type { SharedTrailOwner } from "@/lib/shared-trail-types";

/**
 * "Shared by <name> · <date>" header chip rendered above the trail
 * label on `/s/<code>`. Source data comes from `get_shared_trail` (see
 * migration 025) — name and avatar URL only, never email. When the
 * owner has no display name or has deleted their avatar we fall back
 * to "A Trail user" + the standard placeholder so the layout doesn't
 * collapse.
 */
export function SharedTrailAttribution({
  owner,
  createdAt,
}: {
  owner: SharedTrailOwner;
  createdAt: string;
}) {
  const displayName = owner.name?.trim() || "A Trail user";
  const initials = initialsFor(displayName);
  const dateLabel = new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        {owner.imageUrl ? (
          <AvatarImage src={owner.imageUrl} alt={displayName} />
        ) : null}
        <AvatarFallback className="text-sm font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Shared by
        </span>
        <span className="text-sm font-medium">{displayName}</span>
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
      </div>
    </div>
  );
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
