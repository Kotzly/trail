import { useState } from "react";
import { i18n } from "#i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import TrailLogo from "@ui/components/trail-logo";
import { INITIAL_ONBOARDING_STATE, onboardingStateItem } from "@shared/config/storage-items.js";
import { MARKETING_URLS, openExternal } from "@shared/config/marketing-urls.js";
import { toast } from "sonner";
import { FeedbackDialog, type FeedbackKind } from "@ui/components/feedback-dialog.js";
import { PageHeader } from "../components/PageHeader.js";

const MANIFEST_VERSION = chrome.runtime.getManifest?.()?.version ?? "dev";

export function AboutPage() {
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);

  const replayOnboarding = async () => {
    // Full reset. If a tour tree is still hanging around (e.g., user
    // replays from `tourDismissed`), dispose it first so we don't
    // orphan it — `disposeTourTree` is safe to call when no tour
    // tree exists. Dynamic import to avoid pulling sidepanel RPC
    // clients into the settings bundle; the tree-service proxy
    // works from any extension context.
    const current = await onboardingStateItem.getValue();
    if (current.tourTreeId) {
      try {
        const { disposeTourTree } = await import("@apps/sidepanel/api/onboarding.js");
        await disposeTourTree();
      } catch {
        // Chunk-load or transient RPC failure — worst case the
        // stale tour tree stays visible in the user's tree list.
        // The rest of the replay still proceeds.
      }
    }
    // Use the canonical initial shape so new fields added to
    // `OnboardingState` are reset automatically without touching
    // this file.
    await onboardingStateItem.setValue(INITIAL_ONBOARDING_STATE);
    toast.info(i18n.t("settings.about.replayToast"));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={i18n.t("settings.about.title")}
        description={i18n.t("settings.about.description")}
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <TrailLogo className="size-10" label="Trail" />
          <div className="flex flex-col">
            <CardTitle className="text-base">Trail</CardTitle>
            <CardDescription>
              {i18n.t("settings.about.version", [MANIFEST_VERSION])}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.homepage)}
          >
            {i18n.t("settings.about.homepage")}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.changelog)}
          >
            {i18n.t("settings.about.changelog")}
          </Button>
          <Button variant="outline" className="justify-start" onClick={replayOnboarding}>
            {i18n.t("settings.about.replayWalkthrough")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{i18n.t("settings.about.feedbackTitle")}</CardTitle>
          <CardDescription>{i18n.t("settings.about.feedbackDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("bug")}
          >
            {i18n.t("settings.about.reportBug")}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("feature")}
          >
            {i18n.t("settings.about.suggestFeature")}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("support")}
          >
            {i18n.t("settings.about.contactSupport")}
          </Button>
        </CardContent>
      </Card>

      <FeedbackDialog
        kind={feedbackKind}
        onOpenChange={(open) => {
          if (!open) setFeedbackKind(null);
        }}
      />
    </div>
  );
}
