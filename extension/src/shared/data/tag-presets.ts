import type { Tag } from "../types/ids.js";
import type { TagDefinition } from "../types/tags.js";

export const DEFAULT_TAG_DEFS: TagDefinition[] = [
  {
    id: "important" as Tag,
    label: "Important",
    color: "#ef4444",
    iconId: "AlertTriangle",
    system: true,
  },
  {
    id: "reference" as Tag,
    label: "Reference",
    color: "#3b82f6",
    iconId: "BookOpen",
    system: true,
  },
  { id: "todo" as Tag, label: "To Do", color: "#f59e0b", iconId: "CheckCircle2", system: true },
  { id: "dead-end" as Tag, label: "Dead End", color: "#6b7280", iconId: "XCircle", system: true },
  { id: "bookmark" as Tag, label: "Bookmark", color: "#8b5cf6", iconId: "Bookmark", system: true },
];
