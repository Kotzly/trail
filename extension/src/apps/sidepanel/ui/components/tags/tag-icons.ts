import type { ComponentType } from "react";
import { Icons } from "../Icon.js";

export const TAG_ICON_OPTIONS = [
  { id: "AlertTriangle", label: "Alert", Icon: Icons.AlertTriangle },
  { id: "BookOpen", label: "Reference", Icon: Icons.BookOpen },
  { id: "Bookmark", label: "Bookmark", Icon: Icons.Bookmark },
  { id: "CheckCircle2", label: "Check", Icon: Icons.CheckCircle2 },
  { id: "XCircle", label: "Blocked", Icon: Icons.XCircle },
  { id: "Flag", label: "Flag", Icon: Icons.Flag },
  { id: "Star", label: "Star", Icon: Icons.Star },
  { id: "Tag", label: "Tag", Icon: Icons.Tag },
  { id: "Bell", label: "Bell", Icon: Icons.Bell },
  { id: "Zap", label: "Zap", Icon: Icons.Zap },
] as const;

export type TagIconId = (typeof TAG_ICON_OPTIONS)[number]["id"];

type TagIconComponent = ComponentType<{ size?: number; className?: string }>;

const tagIconMap = new Map<string, TagIconComponent>(
  TAG_ICON_OPTIONS.map((option) => [option.id, option.Icon] as [string, TagIconComponent]),
);

export function getTagIcon(id: string): TagIconComponent {
  return (tagIconMap.get(id) as TagIconComponent) ?? Icons.Tag;
}
