import { toast } from "sonner";
import { captureError } from "@shared/lib/observability.js";

/**
 * Surface an operation failure as a user-visible toast. Also reports the
 * failure to Sentry so repeated toast-surfaced errors are visible in our
 * crash dashboard (they're unhandled from the user's perspective even if
 * the UI recovers gracefully).
 *
 * @param op   Short label for the operation, e.g. "Rename", "Export"
 * @param error  The caught error value (unknown)
 */
export function showOperationError(op: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  const short = reason.length > 120 ? reason.slice(0, 117) + "..." : reason;
  console.error(`[${op}] failed:`, error);
  captureError(error, { op, kind: "operation_error" });
  toast.error(`${op} failed: ${short}`);
}
