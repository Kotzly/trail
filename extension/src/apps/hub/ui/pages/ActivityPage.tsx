import type { RouteParams } from "../router.js";
import { useHubAuth } from "../hooks/useHubAuth.js";
import AuthRequiredPanel from "../components/AuthRequiredPanel.js";
import EmptyState from "../components/EmptyState.js";

export default function ActivityPage(_props: RouteParams) {
  const { authenticated, isLoading } = useHubAuth();

  if (isLoading) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <EmptyState dashed>
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        </EmptyState>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <AuthRequiredPanel />
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
      <EmptyState>
        <p className="text-[13px] text-muted-foreground">Activity tracking is coming soon.</p>
      </EmptyState>
    </>
  );
}
