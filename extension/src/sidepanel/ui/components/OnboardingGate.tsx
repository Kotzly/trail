import React, { useState } from 'react';
import { Icons } from './Icon.js';
import TrailLogo from './TrailLogo.js';
import { useAuthMutations } from '../query/useAuthMutations.js';
import '../styles/onboarding-gate.css';

/**
 * Full-screen blocking overlay shown after first login while the user's
 * onboarding status is "pending". Blocks the main UI until the user
 * clicks "Get started" or "Skip".
 *
 * If the user completes onboarding in the web app, the snapshot poll
 * (useAccountSnapshotQuery) flips the status to "completed" and the
 * parent (App.tsx) stops rendering this component.
 */
export default function OnboardingGate() {
  const { completeOnboardingMutation } = useAuthMutations();
  const [error, setError] = useState<string | null>(null);

  const busy = completeOnboardingMutation.isPending;

  const handleAction = (action: 'complete' | 'skip') => {
    setError(null);
    completeOnboardingMutation.mutate(
      { action, source: 'extension' },
      {
        onError: () => {
          setError('Something went wrong. Please try again.');
        },
      },
    );
  };

  return (
    <div className="onboarding-gate">
      <div className="onboarding-gate__content">
        <TrailLogo className="auth-gate__logo" animated label="Trail" />

        <h1 className="onboarding-gate__title">Welcome to Trail</h1>
        <p className="onboarding-gate__subtitle">
          Trail maps your browsing into a visual tree so you never lose
          context. Click below to get started.
        </p>

        <div className="onboarding-gate__actions">
          <button
            className="onboarding-gate__btn onboarding-gate__btn--primary"
            type="button"
            onClick={() => handleAction('complete')}
            disabled={busy}
          >
            {busy ? (
              <>
                <Icons.RefreshCw size={14} className="onboarding-gate__spinner" />
                Saving…
              </>
            ) : (
              'Get started'
            )}
          </button>

          <button
            className="onboarding-gate__btn"
            type="button"
            onClick={() => handleAction('skip')}
            disabled={busy}
          >
            Skip for now
          </button>
        </div>

        {error && <p className="onboarding-gate__error">{error}</p>}
      </div>
    </div>
  );
}
