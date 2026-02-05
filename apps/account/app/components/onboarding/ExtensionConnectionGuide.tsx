"use client";

import * as React from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
  LockIcon,
  PuzzleIcon,
  RefreshCwIcon,
  ShieldIcon,
} from "lucide-react";

import { FaChrome, FaEdge, FaFirefoxBrowser, FaSafari } from "react-icons/fa";
import { FaBrave } from "react-icons/fa6";
import { Button } from "@trail/ui";
import { cn } from "@trail/ui";

export type BrowserType =
  | "chrome"
  | "brave"
  | "edge"
  | "firefox"
  | "safari"
  | "other";

export type ExtensionConnectionGuideProps = {
  className?: string;
  browserType?: BrowserType;
  onConnectionComplete?: () => void;
};

type GuideStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
};

function detectBrowser(): BrowserType {
  if (typeof window === "undefined") return "other";

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg")) return "edge";
  if (ua.includes("brave")) return "brave";
  if (ua.includes("chrome")) return "chrome";
  if (ua.includes("firefox")) return "firefox";
  return "other";
}

const browserNames: Record<BrowserType, string> = {
  chrome: "chrome",
  brave: "brave",
  edge: "edge",
  firefox: "firefox",
  safari: "safari",
  other: "your browser",
};

const browserIcons: Record<BrowserType, React.ReactNode> = {
  chrome: <FaChrome className="h-5 w-5" />,
  brave: <FaBrave className="h-5 w-5" />,
  edge: <FaEdge className="h-5 w-5" />,
  firefox: <FaFirefoxBrowser className="h-5 w-5" />,
  safari: <FaSafari className="h-5 w-5" />,
  other: <PuzzleIcon className="h-5 w-5" />,
};

function StepCard({
  step,
  index,
  isActive,
  isCompleted,
  onAction,
}: {
  step: GuideStep;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "relative flex gap-4 rounded-xl border p-4 transition-all",
        isCompleted
          ? "border-accent/40 bg-accent/5"
          : isActive
            ? "border-accent/60 bg-surface shadow-sm"
            : "border-border/40 bg-surface/50 opacity-70",
      )}
    >
      {/* Step number */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
          isCompleted
            ? "bg-accent text-accent-contrast"
            : isActive
              ? "bg-accent/20 text-accent animate-pulse"
              : "bg-surface-high text-ink-muted",
        )}
      >
        {isCompleted ? <CheckIcon className="h-4 w-4" /> : index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={cn("text-sm font-medium", isCompleted && "text-accent")}>
          {step.title}
        </h4>
        <p className="text-xs text-ink-muted mt-1">{step.description}</p>

        {/* Action button */}
        {step.action && isActive && !isCompleted && (
          <div className="mt-3">
            {step.action.href ? (
              <Button.AsChild size="sm" variant="outline">
                <Link href={step.action.href} onClick={onAction}>
                  {step.action.label}
                  <ExternalLinkIcon className="ml-1 h-3 w-3" />
                </Link>
              </Button.AsChild>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  step.action?.onClick?.();
                  onAction?.();
                }}
              >
                {step.action.label}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Icon */}
      <div
        className={cn(
          "shrink-0 text-ink-subtle",
          (isCompleted || isActive) && "text-accent",
        )}
      >
        {step.icon}
      </div>
    </motion.div>
  );
}

function TroubleshootingSection() {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const issues = [
    {
      icon: <RefreshCwIcon className="h-4 w-4" />,
      title: "extension not appearing",
      solution:
        "try refreshing the page or restarting your browser. if the issue persists, reinstall the extension.",
    },
    {
      icon: <LockIcon className="h-4 w-4" />,
      title: "permissions denied",
      solution:
        "go to your browser settings > extensions > trail > permissions and ensure all requested permissions are enabled.",
    },
    {
      icon: <AlertCircleIcon className="h-4 w-4" />,
      title: "connection failed",
      solution:
        "check that you're signed in to the same account in both the extension and the dashboard.",
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-surface/50 p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <HelpCircleIcon className="h-4 w-4 text-ink-muted" />
          <span className="text-sm font-medium text-ink">
            troubleshooting tips
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ArrowRightIcon className="h-4 w-4 rotate-90 text-ink-muted" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? "auto" : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="space-y-3 pt-3">
          {issues.map((issue, index) => (
            <div
              key={index}
              className="rounded-lg bg-surface-high/50 p-3 text-xs"
            >
              <div className="flex items-center gap-2 text-ink">
                {issue.icon}
                <span className="font-medium">{issue.title}</span>
              </div>
              <p className="mt-1 text-ink-muted pl-6">{issue.solution}</p>
            </div>
          ))}
          <p className="text-xs text-ink-subtle text-center pt-2">
            still having issues?{" "}
            <Link
              href="mailto:support@gettrail.net"
              className="text-accent hover:underline"
            >
              contact support
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function ExtensionConnectionGuide({
  className,
  browserType: propBrowserType,
  onConnectionComplete,
}: ExtensionConnectionGuideProps) {
  const [detectedBrowser, setDetectedBrowser] =
    React.useState<BrowserType>("chrome");
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    setDetectedBrowser(detectBrowser());
  }, []);

  const browser = propBrowserType || detectedBrowser;
  const browserName = browserNames[browser];

  const steps: GuideStep[] = [
    {
      id: "install",
      title: `install the extension`,
      description: `add trail to ${browserName} from the chrome web store. the installation takes just a few seconds.`,
      icon: browserIcons[browser],
      action: {
        label: "open web store",
        href: "https://chrome.google.com/webstore",
      },
    },
    {
      id: "pin",
      title: "pin to toolbar",
      description: `click the puzzle icon in your toolbar and pin the trail extension for easy access.`,
      icon: <PuzzleIcon className="h-5 w-5" />,
    },
    {
      id: "signin",
      title: "sign in",
      description:
        "click the trail icon and sign in with your account to link your browser.",
      icon: <LockIcon className="h-5 w-5" />,
    },
    {
      id: "test",
      title: "test the connection",
      description:
        "capture your first trail to verify everything is working correctly.",
      icon: <CheckIcon className="h-5 w-5" />,
      action: {
        label: "go to dashboard",
        onClick: () => {
          onConnectionComplete?.();
        },
      },
    },
  ];

  const handleStepAction = (stepId: string) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onConnectionComplete?.();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-surface/70 p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            {browserIcons[browser]}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink">
              connect your {browserName} browser
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              follow these steps to install and connect the trail extension.
              estimated time: 2 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">
          step {currentStep + 1} of {steps.length}
        </span>
        <span className="trail-pill">
          {completedSteps.size}/{steps.length} completed
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            isActive={index === currentStep}
            isCompleted={completedSteps.has(step.id)}
            onAction={() => handleStepAction(step.id)}
          />
        ))}
      </div>

      {/* Troubleshooting */}
      <TroubleshootingSection />

      {/* Security note */}
      <div className="flex items-center gap-2 rounded-lg bg-surface-high/50 p-3 text-xs">
        <ShieldIcon className="h-4 w-4 text-accent shrink-0" />
        <p className="text-ink-muted">
          your data is encrypted and stored securely. we never track your
          browsing on sensitive sites.
        </p>
      </div>
    </div>
  );
}
