/**
 * Screen 8 — Soft CTA. Since Trail is free, we don't ask for a trial.
 * Instead: sign in to sync, or skip. The tagline above the buttons
 * is tailored to the persona picked on screen 3 so the ask feels
 * specific, not generic.
 *
 * Either button disposes of the tour tree (user will make their own)
 * and marks onboarding complete.
 */

import { i18n } from "#i18n";
import { Avatar, AvatarFallback } from "@ui/components/ui/avatar";
import { Button } from "@ui/components/ui/button";
import { Icons } from "@ui/components/icons";
import { completeOnboarding, disposeTourTree } from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";

type I18nArg = Parameters<typeof i18n.t>[0];

async function finish(): Promise<void> {
  await disposeTourTree();
  await completeOnboarding();
  useStore.getState().setOnboarding({
    phase: "done",
    tourTreeId: null,
    tourStep: 0,
    wizardStep: 0,
    completedAt: Date.now(),
  });
  useStore.getState().setSpotlight(null, null);
}

function openLoginInNewTab(): void {
  try {
    const url = chrome.runtime.getURL("/login.html");
    void chrome.tabs.create({ url });
  } catch {
    // no-op — this is a best-effort convenience. If tabs.create
    // fails, completion still proceeds below.
  }
}

export function TourCommitments() {
  const phase = useStore((s) => s.onboarding.phase);
  const persona = useStore((s) => s.onboarding.persona);

  if (phase !== "cta") return null;

  const taglineKey = `onboarding.cta.taglines.${persona ?? "research"}` as I18nArg;

  const handleSignIn = async () => {
    openLoginInNewTab();
    await finish();
  };

  const handleSkip = async () => {
    await finish();
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={i18n.t("onboarding.cta.title" as I18nArg)}
      className="animate-in fade-in-0 bg-background/95 absolute inset-0 z-30 flex flex-col items-center justify-center px-6 backdrop-blur-sm duration-500"
    >
      <div className="animate-in zoom-in-95 slide-in-from-bottom-2 flex w-full max-w-[320px] flex-col items-center gap-5 text-center duration-500">
        <Avatar size="lg" className="size-12">
          <AvatarFallback className="bg-primary/15 text-primary">
            <Icons.Cloud className="size-6" aria-hidden />
          </AvatarFallback>
        </Avatar>
        <div className="flex w-full flex-col items-center gap-2">
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            {i18n.t("onboarding.cta.title" as I18nArg)}
          </h2>
          <p className="text-muted-foreground text-[13px] leading-relaxed">{i18n.t(taglineKey)}</p>
        </div>
        <div className="mt-1 flex w-full flex-col gap-2">
          <Button type="button" size="default" onClick={() => void handleSignIn()}>
            {i18n.t("onboarding.cta.signIn" as I18nArg)}
          </Button>
          <Button
            type="button"
            size="default"
            variant="ghost"
            onClick={() => void handleSkip()}
            className="text-muted-foreground hover:text-foreground"
          >
            {i18n.t("onboarding.cta.skip" as I18nArg)}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TourCommitments;
