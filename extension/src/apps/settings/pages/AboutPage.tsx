import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import TrailLogo from "@ui/components/trail-logo";
import { onboardingStateItem } from "@shared/config/storage-items.js";
import { MARKETING_URLS, openExternal } from "@shared/config/marketing-urls.js";
import { toast } from "sonner";
import { FeedbackDialog, type FeedbackKind } from "@ui/components/feedback-dialog.js";
import { PageHeader } from "../components/PageHeader.js";

const MANIFEST_VERSION = chrome.runtime.getManifest?.()?.version ?? "dev";

export function AboutPage() {
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);

  const replayOnboarding = async () => {
    await onboardingStateItem.setValue({ seenWelcome: false, completedAt: null, step: 0 });
    toast.info("Open the Trail sidepanel to see the walkthrough again.");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="About Trail"
        description="Your browsing sessions, reimagined as a graph."
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <TrailLogo className="size-10" label="Trail" />
          <div className="flex flex-col">
            <CardTitle className="text-base">Trail</CardTitle>
            <CardDescription>Version {MANIFEST_VERSION}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.homepage)}
          >
            Homepage →
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.changelog)}
          >
            Changelog →
          </Button>
          <Button variant="outline" className="justify-start" onClick={replayOnboarding}>
            Replay walkthrough
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback</CardTitle>
          <CardDescription>Tell us what's broken or what you'd like to see.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("bug")}
          >
            Report a bug
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("feature")}
          >
            Suggest a feature
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setFeedbackKind("support")}
          >
            Contact support
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
