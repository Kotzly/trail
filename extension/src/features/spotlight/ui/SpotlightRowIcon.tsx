import { cn } from "../../../ui/lib/utils.js";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive01Icon,
  Copy01Icon,
  LinkSquare01Icon,
  Globe02Icon,
  HelpCircleIcon,
  NeuralNetworkIcon,
  PanelLeftIcon,
  PinIcon,
  PinOffIcon,
  PlusSignIcon,
  Search01Icon,
  Settings02Icon,
  Delete02Icon,
  Upload01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import type { SpotlightSearchResult, SpotlightActionId } from "./types.js";

type IconData = Parameters<typeof HugeiconsIcon>[0]["icon"];

const ACTION_ICONS: Record<SpotlightActionId, IconData> = {
  open: LinkSquare01Icon,
  "open-node-in-tree": LinkSquare01Icon,
  "open-url-only": LinkSquare01Icon,
  "open-url": LinkSquare01Icon,
  "open-tree": NeuralNetworkIcon,
  "search-default-engine": Search01Icon,
  "copy-url": Copy01Icon,
  pin: PinIcon,
  unpin: PinOffIcon,
  "close-tab": Cancel01Icon,
  "close-tabs": Cancel01Icon,
  "archive-current-tree": Archive01Icon,
  "delete-archived-tree": Delete02Icon,
  "export-tree": Upload01Icon,
  "new-tree": PlusSignIcon,
  "show-command-help": HelpCircleIcon,
  "open-settings": Settings02Icon,
  "toggle-sidebar": PanelLeftIcon,
  "clear-history": Delete02Icon,
};

type SpotlightRowIconProps = {
  item: SpotlightSearchResult;
};

function FaviconOrFallback({
  favicon,
  fallback,
}: {
  favicon?: string | undefined;
  fallback: IconData;
}) {
  return (
    <span className="spotlight-row-icon">
      {favicon ? <img src={favicon} alt="" width={16} height={16} /> : <HugeiconsIcon icon={fallback} size={16} />}
    </span>
  );
}

export function SpotlightRowIcon({ item }: SpotlightRowIconProps) {
  if (item.kind === "node") {
    return <FaviconOrFallback favicon={item.favicon} fallback={Globe02Icon} />;
  }

  if (item.kind === "tree") {
    return <FaviconOrFallback favicon={item.favicon} fallback={NeuralNetworkIcon} />;
  }

  const iconData = ACTION_ICONS[item.actionId] ?? LinkSquare01Icon;
  const isDestructive = item.safety === "destructive";

  return (
    <span className={cn("spotlight-row-icon", isDestructive && "spotlight-row-icon--destructive")}>
      <HugeiconsIcon icon={iconData} size={16} />
    </span>
  );
}
