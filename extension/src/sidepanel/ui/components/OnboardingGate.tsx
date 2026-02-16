import React, { useState, useCallback } from 'react';
import { Icons } from './Icon.js';
import TrailLogo from './TrailLogo.js';
import { useAuthMutations } from '../query/useAuthMutations.js';
import '../styles/onboarding-gate.css';

/* ────────────────────────────────────────────────────────────
 * Step definitions — each step showcases a key extension feature.
 * ──────────────────────────────────────────────────────────── */

type StepId = 'welcome' | 'visualize' | 'navigate' | 'organize' | 'ready';

interface Step {
  id: StepId;
  badge?: string;
  title: string;
  body: string;
  details?: { icon: keyof typeof Icons; text: string }[];
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to Trail',
    body: 'Trail maps your browsing into an interactive tree so you never lose context. Let\u2019s take a quick look at what it can do.',
  },
  {
    id: 'visualize',
    badge: 'Core feature',
    title: 'Your browsing, visualized',
    body: 'Every page you visit becomes a node in a live graph. See how your research branches and flows \u2014 automatically.',
    details: [
      { icon: 'Network', text: 'Tree, mindmap & radial layouts' },
      { icon: 'ZoomIn', text: 'Pan, zoom & explore freely' },
      { icon: 'GitBranchPlus', text: 'Branches form as you browse' },
    ],
  },
  {
    id: 'navigate',
    badge: 'Power tools',
    title: 'Find anything instantly',
    body: 'Use search and keyboard shortcuts to navigate your browsing tree at lightning speed.',
    details: [
      { icon: 'Search', text: 'Ctrl/\u2318+K \u2014 Quick search' },
      { icon: 'Keyboard', text: 'Arrow keys to traverse nodes' },
      { icon: 'SlidersHorizontal', text: 'Shift+L \u2014 Switch layout' },
    ],
  },
  {
    id: 'organize',
    badge: 'Stay focused',
    title: 'Organize your trails',
    body: 'Pin pages, tag nodes, and save separate trees for different projects or research topics.',
    details: [
      { icon: 'Pin', text: 'Pin important pages for quick access' },
      { icon: 'Tag', text: 'Tag nodes to filter & group' },
      { icon: 'ListTree', text: 'Multiple trees for different projects' },
    ],
  },
  {
    id: 'ready',
    title: 'You\u2019re all set!',
    body: 'Start browsing and Trail will do the rest. Your tree builds itself \u2014 just open the side panel anytime to see it.',
  },
];

const TOTAL = STEPS.length;

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

export default function OnboardingGate() {
  const { completeOnboardingMutation } = useAuthMutations();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const busy = completeOnboardingMutation.isPending;
  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL - 1;

  const finish = useCallback(
    (action: 'complete' | 'skip') => {
      setError(null);
      completeOnboardingMutation.mutate(
        { action, source: 'extension' },
        {
          onError: () => {
            setError('Something went wrong. Please try again.');
          },
        },
      );
    },
    [completeOnboardingMutation],
  );

  const goNext = () => {
    if (isLast) {
      finish('complete');
    } else {
      setDirection('next');
      setCurrentStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) {
      setDirection('prev');
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <div className="ob">
      <div className="ob__content">
      {/* ── Card ── */}
        <div className="ob__card" key={step.id} data-direction={direction}>
        {/* Welcome step gets the logo */}
        {step.id === 'welcome' && (
          <TrailLogo className="ob__logo" animated label="Trail" />
        )}

        {/* Ready step gets a sparkle icon */}
        {step.id === 'ready' && (
          <div className="ob__ready-icon">
            <Icons.Zap size={28} />
          </div>
        )}

        {/* Badge */}
        {step.badge && <span className="ob__badge">{step.badge}</span>}

        {/* Title & body */}
        <h1 className="ob__title">{step.title}</h1>
        <p className="ob__body">{step.body}</p>

        {/* Feature details list */}
        {step.details && (
          <ul className="ob__details">
            {step.details.map((d) => {
              const Icon = Icons[d.icon];
              return (
                <li key={d.text} className="ob__detail">
                  <span className="ob__detail-icon">
                    <Icon size={15} />
                  </span>
                  <span className="ob__detail-text">{d.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Footer: dots + nav ── */}
      <div className="ob__footer">
        <div className="ob__dots">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`ob__dot${i === currentStep ? ' ob__dot--active' : ''}${i < currentStep ? ' ob__dot--done' : ''}`}
            />
          ))}
        </div>

        <div className="ob__nav">
          {/* Skip — always visible except on last step */}
          {!isLast && (
            <button
              className="ob__btn ob__btn--ghost"
              type="button"
              onClick={() => finish('skip')}
              disabled={busy}
            >
              Skip
            </button>
          )}

          {/* Back */}
          {!isFirst && (
            <button
              className="ob__btn ob__btn--secondary"
              type="button"
              onClick={goPrev}
              disabled={busy}
            >
              <Icons.ChevronLeft size={14} />
              Back
            </button>
          )}

          {/* Next / Finish */}
          <button
            className="ob__btn ob__btn--primary"
            type="button"
            onClick={goNext}
            disabled={busy}
          >
            {busy ? (
              <>
                <Icons.RefreshCw size={14} className="ob__spinner" />
                Saving…
              </>
            ) : isLast ? (
              'Get started'
            ) : isFirst ? (
              <>
                Take the tour
                <Icons.ChevronRight size={14} />
              </>
            ) : (
              <>
                Next
                <Icons.ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
        {error && <p className="ob__error">{error}</p>}
      </div>
    </div>
  );
}
