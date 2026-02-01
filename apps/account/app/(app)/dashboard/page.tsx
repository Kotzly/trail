import Link from "next/link";
import { ArrowRightIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { SectionHeader, StepList } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { DashboardClient } from "./DashboardClient";
import { OnboardingChecklist } from "@/app/components/onboarding/OnboardingChecklist";
import { WelcomeModalWrapper } from "./WelcomeModalWrapper";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  // This would come from your backend/database in a real implementation
  const userProgress = {
    "install-extension": false,
    "connect-account": false,
    "capture-trail": false,
    "share-trail": false,
  };

  const onboardingSteps = [
    {
      id: "install-extension",
      title: "install extension",
      description: "add trail to your browser",
      tooltip: "click to open the chrome web store and install the extension",
      icon: null,
      completed: userProgress["install-extension"],
      href: "/extension",
      estimatedMinutes: 2,
    },
    {
      id: "connect-account",
      title: "connect account",
      description: "link your browser to trail",
      tooltip: "open the extension and sign in with your account",
      icon: null,
      completed: userProgress["connect-account"],
      href: "/extension",
      estimatedMinutes: 1,
    },
    {
      id: "capture-trail",
      title: "capture your first trail",
      description: "record a workflow",
      tooltip: "click the trail icon and start recording your first session",
      icon: null,
      completed: userProgress["capture-trail"],
      href: "/dashboard",
      estimatedMinutes: 3,
    },
    {
      id: "share-trail",
      title: "share or review",
      description: "explore your captures",
      tooltip: "view your trails in the dashboard and share with your team",
      icon: null,
      completed: userProgress["share-trail"],
      href: "/dashboard",
      estimatedMinutes: 2,
    },
  ];

  return (
    <section className="space-y-8">
      {/* Welcome Modal - only shows for first-time users */}
      <WelcomeModalWrapper />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Link
          href="/extension"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/50 bg-surface/60 px-4 py-2.5 transition hover:border-border"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface">
              <LightningBoltIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-ink-muted">{dashboard.activation.eyebrow}</p>
              <p className="text-sm font-semibold text-ink">
                {dashboard.activation.title}
              </p>
              <p className="text-xs text-ink-muted">{dashboard.activation.subtitle}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink">
            {dashboard.activation.cta}
            <ArrowRightIcon className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        {/* Interactive Onboarding Checklist */}
        <OnboardingChecklist
          steps={onboardingSteps}
          initiallyExpanded={true}
        />
      </div>

      <DashboardClient />
    </section>
  );
}
