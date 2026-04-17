import { toast } from "sonner";

const VALID_DURATIONS = new Set<number>([1000, 3000, 5000, 10000, 15000]);

const FIRST_PRUNE_SEEN_KEY = "trail.ui.seenFirstPruneToast";

export type UiToastNotification = {
  message: string;
  icon?: string;
  durationMs?: number;
};

export type ToastKind = "success" | "error" | "info" | "default";

export type ToastApi = {
  success: (message: string, options?: { duration?: number }) => void;
  error: (message: string, options?: { duration?: number }) => void;
  info: (message: string, options?: { duration?: number }) => void;
  default: (message: string, options?: { duration?: number }) => void;
};

const sonnerToastApi: ToastApi = {
  success: (message, options) => toast.success(message, options),
  error: (message, options) => toast.error(message, options),
  info: (message, options) => toast.info(message, options),
  default: (message, options) => toast(message, options),
};

export function normalizeToastDuration(durationMs?: number): number {
  if (typeof durationMs !== "number") return 3000;
  return VALID_DURATIONS.has(durationMs) ? durationMs : 3000;
}

export function mapIconToToastKind(icon?: string): ToastKind {
  if (icon === "Check" || icon === "CheckCircle2") return "success";
  if (icon === "AlertTriangle" || icon === "X" || icon === "XCircle") return "error";
  if (icon === "Info") return "info";
  return "default";
}

export function showUiToast(
  notification: UiToastNotification,
  toastApi: ToastApi = sonnerToastApi,
): void {
  const duration = normalizeToastDuration(notification.durationMs);
  const kind = mapIconToToastKind(notification.icon);
  const options = { duration };

  if (kind === "success") {
    toastApi.success(notification.message, options);
    return;
  }
  if (kind === "error") {
    toastApi.error(notification.message, options);
    return;
  }
  if (kind === "info") {
    toastApi.info(notification.message, options);
    return;
  }
  toastApi.default(notification.message, options);
}

async function hasSeenFirstPruneToast(): Promise<boolean> {
  try {
    const res = await chrome.storage.local.get(FIRST_PRUNE_SEEN_KEY);
    return Boolean(res[FIRST_PRUNE_SEEN_KEY]);
  } catch {
    // If storage is unavailable, err toward suppressing the toast — a
    // one-time onboarding hint missed is less annoying than one shown
    // repeatedly because we can't persist the ack.
    return true;
  }
}

async function markFirstPruneToastSeen(): Promise<void> {
  try {
    await chrome.storage.local.set({ [FIRST_PRUNE_SEEN_KEY]: true });
  } catch {
    /* non-fatal */
  }
}

export type FirstPruneToastActions = {
  onView: () => void;
  onOpenSettings: () => void;
};

/**
 * Fires the one-time "Trail cleaned up N pages" toast. Safe to call on
 * every tree update: it's a no-op if the flag is already set, and it
 * sets the flag before dispatching so concurrent callers can't
 * double-fire. `count` is the current total tombstone count — callers
 * should gate on count > 0 before invoking.
 */
export async function maybeShowFirstPruneToast(
  count: number,
  actions: FirstPruneToastActions,
): Promise<void> {
  if (count <= 0) return;
  if (await hasSeenFirstPruneToast()) return;
  await markFirstPruneToastSeen();
  const message =
    count === 1
      ? "Trail cleaned up 1 quick-peek page."
      : `Trail cleaned up ${count} quick-peek pages.`;
  toast(message, {
    duration: 10000,
    action: {
      label: "View",
      onClick: actions.onView,
    },
    cancel: {
      label: "Settings",
      onClick: actions.onOpenSettings,
    },
  });
}
