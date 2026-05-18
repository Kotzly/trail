import { useState } from "react";
import { i18n } from "#i18n";
import { Button } from "@ui/components/ui/button";
import TrailLogo from "@ui/components/trail-logo";
import { INITIAL_ONBOARDING_STATE, onboardingStateItem } from "@shared/config/storage-items.js";
import { MARKETING_URLS, openExternal } from "@shared/config/marketing-urls.js";
import { toast } from "sonner";
import { FeedbackDialog, type FeedbackKind } from "@ui/components/feedback-dialog.js";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";

const MANIFEST_VERSION = chrome.runtime.getManifest?.()?.version ?? "dev";

export function AboutPage() {
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);

  const replayOnboarding = async () => {
    // Use the canonical initial shape so new fields added to
    // `OnboardingState` are reset automatically without touching
    // this file.
    await onboardingStateItem.setValue(INITIAL_ONBOARDING_STATE);
    toast.info(i18n.t("settings.about.replayToast"));
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={i18n.t("settings.about.title")}
        description={i18n.t("settings.about.description")}
      />

      <section className="flex flex-col gap-4">
        <SectionHeader eyebrow={i18n.t("settings.about.appEyebrow")} />
        <div className="flex items-center gap-3">
          <TrailLogo className="size-10" label="Trail" />
          <div className="flex flex-col leading-tight">
            <span className="text-foreground text-base font-medium tracking-tight">Trail</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {i18n.t("settings.about.version", [MANIFEST_VERSION])}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.homepage)}
          >
            {i18n.t("settings.about.homepage")}
          </Button>
          <Button variant="outline" className="justify-start" onClick={replayOnboarding}>
            {i18n.t("settings.about.replayWalkthrough")}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={i18n.t("settings.about.feedbackEyebrow")}
          description={i18n.t("settings.about.feedbackDescription")}
        />
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("bug")}
            data-testid="about-feedback-bug"
          >
            {i18n.t("settings.about.reportBug")}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("feature")}
            data-testid="about-feedback-feature"
          >
            {i18n.t("settings.about.suggestFeature")}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("support")}
            data-testid="about-feedback-support"
          >
            {i18n.t("settings.about.contactSupport")}
          </Button>
        </div>
      </section>

      <FeedbackDialog
        kind={feedbackKind}
        onOpenChange={(open) => {
          if (!open) setFeedbackKind(null);
        }}
      />
    </div>
  );
}
