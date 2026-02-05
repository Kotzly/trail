"use client";

import * as React from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  BackpackIcon,
  CompassIcon,
  PuzzleIcon,
  HeartHandshakeIcon,
  HistoryIcon,
  LayoutGridIcon,
  LightbulbIcon,
  PlugIcon,
  RocketIcon,
  SearchIcon,
  SparklesIcon,
  TargetIcon,
  TelescopeIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { Button } from "@trail/ui";
import { cn } from "@trail/ui";

export type EmptyStateVariant =
  | "no-trails"
  | "no-extension"
  | "no-team"
  | "no-activity"
  | "no-search-results"
  | "no-sessions"
  | "welcome";

export type EmptyStateProps = {
  variant: EmptyStateVariant;
  className?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  customTitle?: string;
  customDescription?: string;
  customIcon?: React.ReactNode;
};

const variants: Record<
  EmptyStateVariant,
  {
    icon: React.ReactNode;
    title: string;
    description: string;
    personality: string;
    action?: { label: string; href: string };
    secondaryAction?: { label: string; href: string };
    features?: string[];
  }
> = {
  "no-trails": {
    icon: <BackpackIcon className="h-8 w-8" />,
    title: "no trails yet",
    description:
      "your captured workflows will appear here once you start recording.",
    personality: "every great journey starts with a single step. or click.",
    action: { label: "start capturing", href: "/extension" },
    secondaryAction: { label: "learn more", href: "/docs" },
    features: [
      "automatic workflow detection",
      "smart session grouping",
      "share with your team",
    ],
  },
  "no-extension": {
    icon: <PlugIcon className="h-8 w-8" />,
    title: "extension not connected",
    description:
      "install the trail browser extension to start capturing your workflows.",
    personality: "think of it as your personal guide through the web.",
    action: { label: "install extension", href: "/extension" },
    secondaryAction: { label: "view setup guide", href: "/extension" },
    features: [
      "one-click installation",
      "works with chrome & brave",
      "secure & private",
    ],
  },
  "no-team": {
    icon: <UsersIcon className="h-8 w-8" />,
    title: "flying solo for now",
    description:
      "team features are coming soon. you'll be able to invite colleagues and share trails.",
    personality:
      "good things come to those who wait. great things come to those who trail.",
    features: [
      "collaborative workspaces",
      "role-based permissions",
      "shared trail libraries",
    ],
  },
  "no-activity": {
    icon: <HistoryIcon className="h-8 w-8" />,
    title: "quiet day?",
    description:
      "no recent activity to show. your latest actions will appear here.",
    personality:
      "sometimes silence is golden. sometimes it means you need more coffee.",
    action: { label: "capture something", href: "/extension" },
    features: ["real-time sync status", "session history", "activity insights"],
  },
  "no-search-results": {
    icon: <SearchIcon className="h-8 w-8" />,
    title: "no matches found",
    description:
      "we couldn't find anything matching your search. try different keywords?",
    personality:
      "even the best explorers get lost sometimes. try another path.",
    features: ["search by trail name", "filter by date", "filter by tags"],
  },
  "no-sessions": {
    icon: <LayoutGridIcon className="h-8 w-8" />,
    title: "no active sessions",
    description:
      "your device sessions will appear here once you connect the extension.",
    personality: "it's like having a map, but you haven't unfolded it yet.",
    action: { label: "connect extension", href: "/extension" },
    secondaryAction: { label: "troubleshoot", href: "/extension" },
    features: [
      "manage device access",
      "view last seen times",
      "revoke sessions",
    ],
  },
  welcome: {
    icon: <SparklesIcon className="h-8 w-8" />,
    title: "welcome to trail",
    description:
      "capture, organize, and share your workflows. let's get you started.",
    personality: "ready to turn your browsing into actionable insights?",
    action: { label: "get started", href: "/extension" },
    secondaryAction: { label: "take a tour", href: "#" },
    features: [
      "capture any workflow",
      "auto-organize by session",
      "share with your team",
    ],
  },
};

function IllustrationContainer({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: EmptyStateVariant;
}) {
  const colors: Record<EmptyStateVariant, string> = {
    "no-trails": "from-accent/20 to-accent/5",
    "no-extension": "from-blue-500/20 to-blue-500/5",
    "no-team": "from-purple-500/20 to-purple-500/5",
    "no-activity": "from-amber-500/20 to-amber-500/5",
    "no-search-results": "from-pink-500/20 to-pink-500/5",
    "no-sessions": "from-emerald-500/20 to-emerald-500/5",
    welcome: "from-accent/30 to-accent/10",
  };

  return (
    <div
      className={cn(
        "relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br text-accent",
        colors[variant],
      )}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10"
      >
        {children}
      </motion.div>
      {/* Decorative elements */}
      <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent/30" />
      <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-accent/20" />
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {features.map((feature, index) => (
        <motion.li
          key={feature}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 + 0.3 }}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-ink-muted"
        >
          <ZapIcon className="h-3 w-3 text-accent" />
          {feature}
        </motion.li>
      ))}
    </ul>
  );
}

export function EmptyState({
  variant,
  className,
  action,
  secondaryAction,
  customTitle,
  customDescription,
  customIcon,
}: EmptyStateProps) {
  const config = variants[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-surface/70 p-8 text-center",
        className,
      )}
      role="region"
      aria-label={config.title}
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <IllustrationContainer variant={variant}>
            {customIcon || config.icon}
          </IllustrationContainer>
        </div>

        {/* Text content */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-ink md:text-2xl">
            {customTitle || config.title}
          </h3>
          <p className="trail-copy mx-auto max-w-sm">
            {customDescription || config.description}
          </p>
          <p className="text-xs text-ink-subtle italic">{config.personality}</p>
        </div>

        {/* Features */}
        {config.features && <FeatureList features={config.features} />}

        {/* Actions */}
        {(action || secondaryAction || config.action) && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {action ||
              (config.action && (
                <Button.AsChild size="sm">
                  <Link href={config.action.href}>{config.action.label}</Link>
                </Button.AsChild>
              ))}
            {secondaryAction ||
              (config.secondaryAction && (
                <Button.AsChild size="sm" variant="outline">
                  <Link href={config.secondaryAction.href}>
                    {config.secondaryAction.label}
                  </Link>
                </Button.AsChild>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Specialized empty state components for specific use cases
export function NoTrailsEmptyState(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="no-trails" {...props} />;
}

export function NoExtensionEmptyState(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="no-extension" {...props} />;
}

export function NoTeamEmptyState(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="no-team" {...props} />;
}

export function NoActivityEmptyState(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="no-activity" {...props} />;
}

export function WelcomeEmptyState(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="welcome" {...props} />;
}
