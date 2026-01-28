import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveSettings } from '../../api/settings.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { Icons } from './Icon.js';
import { useAuthPortalFlow } from '../hooks/useAuthPortalFlow.js';
import React from 'react';

type Step = {
  id: string;
  title: string;
  subtitle: string;
  body: React.ReactNode;
};

export default function OnboardingOverlay() {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const account = useStore((state) => state.account);
  const shouldOpen = Boolean(settings && !settings.onboardingSeen);

  const [stepIndex, setStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(shouldOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const { busy: authBusy, notice: authNotice, startAuthFlow } = useAuthPortalFlow();

  useOverlayEffects(isMounted, { lod: true, blur: true, kind: 'modal' });

  const handleFinish = useCallback(async () => {
    if (!settings) return;
    const next = { ...settings, onboardingSeen: true };
    setSettings(next);
    try {
      await saveSettings(next);
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, [setSettings, settings]);

  useEffect(() => {
    if (shouldOpen) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsMounted(true);
      setIsClosing(false);
      return;
    }
    if (!isMounted) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 180);
  }, [isMounted, shouldOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleFinish();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [handleFinish, isMounted]);

  useEffect(() => {
    if (shouldOpen) {
      setStepIndex(0);
    }
  }, [shouldOpen]);

  const isAuthenticated = account.session.status === 'authenticated' && Boolean(account.user);
  const displayName = account.user?.displayName || account.user?.email || 'your account';

  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'welcome',
        title: 'Welcome to Trail',
        subtitle: 'Your browsing, mapped as a living tree.',
        body: (
          <>
            <div className="onboarding-hero">
              <div className="onboarding-hero-badge">
                <Icons.Network size={16} />
                Trail Sidepanel
              </div>
              <div className="onboarding-hero-title">Follow paths, not just pages.</div>
              <div className="onboarding-hero-subtitle">
                Trail turns every tab into a visual journey you can revisit, pin, and share.
              </div>
            </div>
            <div className="onboarding-feature-grid">
              {[
                { icon: Icons.Pin, title: 'Pin & save', text: 'Keep important pages and whole trees.' },
                { icon: Icons.Tag, title: 'Tag everything', text: 'Color-coded tags for instant recall.' },
                { icon: Icons.Search, title: 'Instant search', text: 'Jump to any node in seconds.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="onboarding-feature-card">
                    <div className="onboarding-feature-icon">
                      <Icon size={16} />
                    </div>
                    <div className="onboarding-feature-title">{item.title}</div>
                    <div className="onboarding-feature-text">{item.text}</div>
                  </div>
                );
              })}
            </div>
          </>
        ),
      },
      {
        id: 'controls',
        title: 'Know your controls',
        subtitle: 'Everything is within reach in the top bar.',
        body: (
          <>
            <div className="onboarding-map">
              <div className="onboarding-map-top">
                <div className="onboarding-map-group">
                  <span className="onboarding-map-orb"><Icons.Pin size={14} /></span>
                  <span className="onboarding-map-orb"><Icons.ListTree size={14} /></span>
                  <span className="onboarding-map-orb"><Icons.Tag size={14} /></span>
                </div>
                <div className="onboarding-map-group right">
                  <span className="onboarding-map-orb"><Icons.Search size={14} /></span>
                  <span className="onboarding-map-orb"><Icons.Palette size={14} /></span>
                  <span className="onboarding-map-orb"><Icons.Settings size={14} /></span>
                </div>
              </div>
              <div className="onboarding-map-body">
                <div className="onboarding-map-node" />
                <div className="onboarding-map-node" />
                <div className="onboarding-map-node" />
              </div>
            </div>
            <div className="onboarding-control-list">
              <div className="onboarding-control-item">
                <Icons.Pin size={14} />
                Pinned, saved trees, and tag filters live on the left.
              </div>
              <div className="onboarding-control-item">
                <Icons.Search size={14} />
                Search, theme, and settings are on the right.
              </div>
              <div className="onboarding-control-item">
                <Icons.MousePointer2 size={14} />
                Right-click any node for actions, tabs, and tags.
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'account',
        title: 'Sync and personalize',
        subtitle: 'Sign in to sync tags, themes, and saved trees.',
        body: (
          <>
            <div className="onboarding-feature-grid">
              {[
                { icon: Icons.Sparkles, title: 'Themes', text: 'Curate the vibe of your workspace.' },
                { icon: Icons.Bookmark, title: 'Saved trails', text: 'Return to the moments that mattered.' },
                { icon: Icons.Shield, title: 'Private by default', text: 'You control what syncs.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="onboarding-feature-card">
                    <div className="onboarding-feature-icon">
                      <Icon size={16} />
                    </div>
                    <div className="onboarding-feature-title">{item.title}</div>
                    <div className="onboarding-feature-text">{item.text}</div>
                  </div>
                );
              })}
            </div>
            <div className="onboarding-auth">
              {isAuthenticated ? (
                <div className="onboarding-auth-success">
                  <Icons.CheckCircle2 size={16} />
                  Signed in as {displayName}.
                </div>
              ) : (
                <>
                  <div className="onboarding-auth-actions">
                    <button
                      className="onboarding-btn primary"
                      type="button"
                      onClick={() => void startAuthFlow({ source: 'extension-onboarding-signin' })}
                      disabled={authBusy}
                    >
                      {authBusy ? 'Opening…' : 'Sign in'}
                    </button>
                    <button
                      className="onboarding-btn secondary"
                      type="button"
                      onClick={() => void startAuthFlow({ source: 'extension-onboarding-signup' })}
                      disabled={authBusy}
                    >
                      Create account
                    </button>
                    <button className="onboarding-btn ghost" type="button" onClick={() => void handleFinish()}>
                      Continue as guest
                    </button>
                  </div>
                  {authNotice ? <div className="onboarding-auth-note">{authNotice}</div> : null}
                </>
              )}
            </div>
          </>
        ),
      },
    ],
    [authBusy, authNotice, displayName, isAuthenticated, startAuthFlow, handleFinish],
  );

  if (!isMounted || typeof document === 'undefined') return null;

  const step = steps[stepIndex] ?? steps[0];
  if (!step) return null;
  const isLast = stepIndex === steps.length - 1;

  return createPortal(
    <div className={`modal-overlay onboarding-overlay${isClosing ? ' closing' : ''}`} onClick={() => void handleFinish()}>
      <div
        className={`onboarding-panel${isClosing ? ' closing' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="onboarding-header">
          <div>
            <div className="onboarding-title">{step.title}</div>
            <div className="onboarding-subtitle">{step.subtitle}</div>
          </div>
          <div className="onboarding-header-actions">
            <button className="onboarding-skip" type="button" onClick={() => void handleFinish()}>
              Skip
            </button>
            <button className="dropdown-close-btn onboarding-close" type="button" aria-label="Close onboarding" onClick={() => void handleFinish()}>
              <Icons.X size={14} />
            </button>
          </div>
        </div>

        <div className="onboarding-body">{step.body}</div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {steps.map((item, index) => (
              <span key={item.id} className={`onboarding-dot${index === stepIndex ? ' active' : ''}`} />
            ))}
          </div>
          <div className="onboarding-actions">
            <button
              className="onboarding-btn ghost"
              type="button"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
            >
              Back
            </button>
            <button
              className="onboarding-btn primary"
              type="button"
              onClick={() => {
                if (isLast) {
                  void handleFinish();
                } else {
                  setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
                }
              }}
            >
              {isLast ? 'Start exploring' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
