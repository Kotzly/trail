import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { PageHeader } from "../components/PageHeader.js";
import { Button } from "@ui/components/ui/button";
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui/components/ui/alert-dialog";
import { TreesPage } from "./TreesPage.js";
import { browser } from "@shared/platform/webext.js";
import { captureEvent, captureError } from "@shared/lib/observability.js";
import { toast } from "sonner";
import { signOut } from "@shared/auth/auth-orchestrator.js";
import { getSupabaseClient } from "@shared/lib/supabase.js";

export function DataPage() {
  const [clearing, clearingActions] = useBoolean(false);
  const [deleting, deletingActions] = useBoolean(false);

  const clearLocal = useLockFn(async () => {
    clearingActions.setTrue();
    try {
      // Wipe everything Trail owns in local + session storage.
      await browser.storage.local.clear();
      await browser.storage.session?.clear().catch(() => {});
      captureEvent("tree_exported", { kind: "clear_local" });
      toast.success("Local data cleared. Reload the sidepanel to start fresh.");
    } catch (error) {
      captureError(error, { kind: "ui_clear_local" });
      toast.error("Failed to clear local data", { description: String(error) });
    } finally {
      clearingActions.setFalse();
    }
  });

  const deleteAccount = useLockFn(async () => {
    deletingActions.setTrue();
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Try server RPC first; if it doesn't exist (MVP), soft-delete
        // all owned trails directly. A scheduled job handles hard removal.
        const rpcResult = await supabase.rpc("request_account_deletion");
        if (rpcResult.error) {
          await supabase
            .from("trails")
            .update({ deleted_at: new Date().toISOString() })
            .neq("id", "00000000-0000-0000-0000-000000000000");
        }
      }
      await signOut();
      await browser.storage.local.clear();
      await browser.storage.session?.clear().catch(() => {});
      captureEvent("auth_signout", { reason: "account_deletion" });
      toast.success("Account deletion requested", {
        description:
          "Your local data has been cleared and your session ended. " +
          "Server-side data removal completes within 30 days.",
        duration: 8000,
      });
    } catch (error) {
      captureError(error, { kind: "ui_delete_account" });
      toast.error("Failed to request account deletion", { description: String(error) });
    } finally {
      deletingActions.setFalse();
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Data"
        description="Export, import, and manage your trees. Your data is yours."
      />

      <TreesPage />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danger zone</CardTitle>
          <CardDescription>Irreversible actions. Read the warnings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={clearing}>
                Clear local data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all local data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all trees, settings, and the current session from your browser. If
                  you're signed in, server-side data is NOT affected — re-open the sidepanel to
                  re-sync.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void clearLocal()}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                Delete account & all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your Trail account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This requests deletion of your account and all cloud-stored trees. Local data is
                  cleared immediately. Server-side deletion completes within 30 days per our privacy
                  policy. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void deleteAccount()}>
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
