import { toast } from "sonner";

const VALID_DURATIONS = new Set<number>([1000, 3000, 5000, 10000, 15000]);

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
