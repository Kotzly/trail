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
      className="animate-in fade-in-0 bg-background absolute inset-0 z-30 flex flex-col justify-end px-6 pt-10 pb-12 duration-500"
    >
      <div className="animate-in slide-in-from-bottom-2 flex w-full max-w-[55ch] flex-col items-start gap-3 duration-500">
        <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
          <Icons.Cloud className="text-primary size-3" aria-hidden strokeWidth={1.75} />
          <span>{i18n.t("onboarding.cta.eyebrow" as I18nArg)}</span>
        </div>
        <h2 className="text-foreground font-serif text-[clamp(24px,4.6vw,34px)] leading-[1.05] font-normal tracking-tight">
          {i18n.t("onboarding.cta.title" as I18nArg)}
        </h2>
        <p className="text-muted-foreground max-w-[55ch] text-[14px] leading-relaxed">
          {i18n.t(taglineKey)}
        </p>
        <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
