import type { RouteParams } from '../router.js';
import { useAccountAuth } from '../hooks/useAccountAuth.js';
import AuthRequiredPanel from '../components/AuthRequiredPanel.js';

export default function BillingPage(_props: RouteParams) {
  const { authenticated, isLoading } = useAccountAuth();

  if (isLoading) {
    return (
      <div className="account-page">
        <h1 className="account-page__title">Billing</h1>
        <div className="account-empty">
          <p className="account-empty__text">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="account-page">
        <h1 className="account-page__title">Billing</h1>
        <AuthRequiredPanel />
      </div>
    );
  }

  return (
    <div className="account-page">
      <h1 className="account-page__title">Billing</h1>
      <div className="account-placeholder">
        <p className="account-placeholder__text">
          Billing management is coming soon.
        </p>
      </div>
    </div>
  );
}
