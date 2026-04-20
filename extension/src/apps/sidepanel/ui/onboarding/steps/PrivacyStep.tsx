import { i18n } from "#i18n";
import { Icons } from "@ui/components/icons";

const RECORDED_KEYS = [
  "onboarding.privacy.recordedItems.url",
  "onboarding.privacy.recordedItems.title",
  "onboarding.privacy.recordedItems.favicon",
] as const;

const NEVER_KEYS = [
  "onboarding.privacy.neverItems.keystrokes",
  "onboarding.privacy.neverItems.formContent",
  "onboarding.privacy.neverItems.passwords",
] as const;

export function PrivacyStep() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-300">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-400">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.privacy.title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {i18n.t("onboarding.privacy.body")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <section
          className="bg-card border-border/70 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-2 rounded-lg border p-3 delay-75 duration-400"
          aria-labelledby="privacy-recorded-head"
        >
          <header className="flex items-center gap-1.5">
            <span
              className="bg-primary/10 text-primary flex size-5 items-center justify-center rounded-full"
              aria-hidden
            >
              <Icons.Check className="size-3" strokeWidth={2.75} />
            </span>
            <span
              id="privacy-recorded-head"
              className="text-foreground text-xs font-medium tracking-tight"
            >
              {i18n.t("onboarding.privacy.recordedHeader")}
            </span>
          </header>
          <ul className="flex flex-col gap-1">
            {RECORDED_KEYS.map((key) => (
              <li key={key} className="text-foreground text-xs leading-snug">
                {i18n.t(key)}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="bg-muted/40 border-border/70 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-2 rounded-lg border p-3 delay-100 duration-400"
          aria-labelledby="privacy-never-head"
        >
          <header className="flex items-center gap-1.5">
            <span
              className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full"
              aria-hidden
            >
              <Icons.X className="size-3" strokeWidth={2.75} />
            </span>
            <span
              id="privacy-never-head"
              className="text-foreground text-xs font-medium tracking-tight"
            >
              {i18n.t("onboarding.privacy.neverHeader")}
            </span>
          </header>
          <ul className="flex flex-col gap-1">
            {NEVER_KEYS.map((key) => (
              <li
                key={key}
                className="text-muted-foreground decoration-muted-foreground/40 text-xs leading-snug line-through"
              >
                {i18n.t(key)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both inline-flex items-center gap-1.5 text-[11px] delay-150 duration-400">
        <Icons.Shield className="size-3" aria-hidden />
        <span>{i18n.t("onboarding.privacy.footer")}</span>
      </p>
    </div>
  );
}
