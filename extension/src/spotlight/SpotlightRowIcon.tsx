import {
  Archive,
  Copy,
  ExternalLink,
  Globe,
  HelpCircle,
  Network,
  PanelLeft,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { SpotlightSearchResult, SpotlightActionId } from "./types.js";
import type { ComponentType } from "react";

const ACTION_ICONS: Record<SpotlightActionId, ComponentType<{ size: number }>> = {
  open: ExternalLink,
  "open-node-in-tree": ExternalLink,
  "open-url-only": ExternalLink,
  "open-url": ExternalLink,
  "open-tree": Network,
  "search-default-engine": Search,
  "copy-url": Copy,
  pin: Pin,
  unpin: PinOff,
  "close-tab": X,
  "close-tabs": X,
  "archive-current-tree": Archive,
  "delete-archived-tree": Trash2,
  "export-tree": Upload,
  "new-tree": Plus,
  "show-command-help": HelpCircle,
  "open-settings": Settings,
  "toggle-sidebar": PanelLeft,
  "clear-history": Trash2,
};

type SpotlightRowIconProps = {
  item: SpotlightSearchResult;
};

function FaviconOrFallback({
  favicon,
  fallback: Fallback,
}: {
  favicon?: string | undefined;
  fallback: ComponentType<{ size: number }>;
}) {
  return (
    <span className="spotlight-row-icon">
      {favicon ? <img src={favicon} alt="" width={16} height={16} /> : <Fallback size={16} />}
    </span>
  );
}

export function SpotlightRowIcon({ item }: SpotlightRowIconProps) {
  if (item.kind === "node") {
    return <FaviconOrFallback favicon={item.favicon} fallback={Globe} />;
  }

  if (item.kind === "tree") {
    return <FaviconOrFallback favicon={item.favicon} fallback={Network} />;
  }

  const Icon = ACTION_ICONS[item.actionId] ?? ExternalLink;
  const isDestructive = item.safety === "destructive";

  return (
    <span className={`spotlight-row-icon${isDestructive ? "spotlight-row-icon--destructive" : ""}`}>
      <Icon size={16} />
    </span>
  );
}
