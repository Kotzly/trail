import { useEffect } from 'react';
import { defineRoute, useRoute, navigate } from './router.js';
import AccountLayout from './layouts/AccountLayout.js';
import TrailsPage from './pages/TrailsPage.js';
import TrailDetailPage from './pages/TrailDetailPage.js';
import TrailImportPage from './pages/TrailImportPage.js';
import SettingsPage from './pages/SettingsPage.js';
import BillingPage from './pages/BillingPage.js';
import ActivityPage from './pages/ActivityPage.js';
import GettingStartedPage from './pages/GettingStartedPage.js';

const routes = [
  defineRoute('/trails', TrailsPage),
  defineRoute('/trails/import', TrailImportPage),
  defineRoute('/trails/:id', TrailDetailPage),
  defineRoute('/settings', SettingsPage),
  defineRoute('/billing', BillingPage),
  defineRoute('/activity', ActivityPage),
  defineRoute('/getting-started', GettingStartedPage),
] as const;

export default function AccountApp() {
  const match = useRoute(routes);

  useEffect(() => {
    if (!match) {
      navigate('/trails');
    }
  }, [match]);

  if (!match) return null;

  const { route, params } = match;
  const Page = route.component;

  return (
    <AccountLayout>
      <Page params={params} />
    </AccountLayout>
  );
}
