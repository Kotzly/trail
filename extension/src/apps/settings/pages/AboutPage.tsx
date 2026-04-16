import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import TrailLogo from "@ui/components/trail-logo";
import { onboardingStateItem } from "@shared/config/storage-items.js";
import { captureEvent } from "@shared/lib/observability.js";

const MANIFEST_VERSION = chrome.runtime.getManifest?.()?.version ?? "dev";
const HOMEPAGE = "https://gettrail.net";
const SUPPORT_URL = "https://gettrail.net/support";
const FEEDBACK_URL = "https://github.com/trailapp/trail-extension/issues/new/choose";
const CHANGELOG_URL = "https://gettrail.net/changelog";

export function AboutPage() {
  const sendFeedback = (kind: "bug" | "feature" | "support") => {
    captureEvent("feedback_submitted", { kind });
    const url =
      kind === "support"
        ? SUPPORT_URL
        : `${FEEDBACK_URL}?labels=${kind === "bug" ? "bug" : "enhancement"}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const replayOnboarding = async () => {
    await onboardingStateItem.setValue({ seenWelcome: false, completedAt: null, step: 0 });
    // Open the sidepanel so the user sees the wizard. We can't directly
    // open the sidepanel from a settings tab, so prompt via a toast-like
    // instruction is the best we can do here.
    alert("Open the Trail sidepanel to see the walkthrough again.");
  };

  return (
    <div className="flex flex-col gap-4">
      <CardHeader className="px-0">
        <CardTitle>About Trail</CardTitle>
        <CardDescription>Your browsing sessions, reimagined as a graph.</CardDescription>
      </CardHeader>

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
            onClick={() => window.open(HOMEPAGE, "_blank", "noopener,noreferrer")}
          >
            Homepage →
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => window.open(CHANGELOG_URL, "_blank", "noopener,noreferrer")}
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
          <Button variant="outline" className="justify-start" onClick={() => sendFeedback("bug")}>
            Report a bug
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => sendFeedback("feature")}
          >
            Suggest a feature
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => sendFeedback("support")}
          >
            Contact support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
