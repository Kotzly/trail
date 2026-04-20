import { i18n } from "#i18n";
import TrailLogo from "@ui/components/trail-logo";

export function WelcomeStep() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col items-center gap-5 text-center duration-300">
      {/* The logo itself is the demo — it literally animates the graph metaphor */}
      <div className="animate-in fade-in-0 zoom-in-95 relative duration-500">
        <div
          aria-hidden
          className="bg-primary/10 absolute inset-0 -z-10 blur-2xl"
          style={{ transform: "scale(1.4)" }}
        />
        <TrailLogo animated variant="field" className="trail-logo-hero" label="Trail" />
      </div>

      <div className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both flex flex-col gap-1.5 delay-75 duration-500">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">
          {i18n.t("onboarding.welcome.title")}
        </h2>
        <p className="text-muted-foreground mx-auto max-w-[300px] text-sm leading-relaxed">
          {i18n.t("onboarding.welcome.body")}
        </p>
      </div>
    </div>
  );
}
