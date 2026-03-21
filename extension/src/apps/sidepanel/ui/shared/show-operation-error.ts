import { toast } from "sonner";

/**
 * Surface an operation failure as a user-visible toast.
 * Keeps console.error for dev diagnostics alongside the user notification.
 *
 * @param op   Short label for the operation, e.g. "Rename", "Export"
 * @param error  The caught error value (unknown)
 */
export function showOperationError(op: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  const short = reason.length > 120 ? reason.slice(0, 117) + "..." : reason;
  console.error(`[${op}] failed:`, error);
  toast.error(`${op} failed: ${short}`);
}
