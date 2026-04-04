import type { RouteParams } from "../router.js";
import { useHubAuth } from "../hooks/useHubAuth.js";
import AuthRequiredPanel from "../components/AuthRequiredPanel.js";

export default function BillingPage(_props: RouteParams) {
  const { authenticated, isLoading } = useHubAuth();

  if (isLoading) {
    return (
      <div className="hub-page">
        <h1 className="hub-page__title">Billing</h1>
        <div className="hub-empty">
          <p className="hub-empty__text">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="hub-page">
        <h1 className="hub-page__title">Billing</h1>
        <AuthRequiredPanel />
      </div>
    );
  }

  return (
    <div className="hub-page">
      <h1 className="hub-page__title">Billing</h1>
      <div className="hub-placeholder">
        <p className="hub-placeholder__text">Billing management is coming soon.</p>
      </div>
    </div>
  );
}
