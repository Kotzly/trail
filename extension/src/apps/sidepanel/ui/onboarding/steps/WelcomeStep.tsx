import { i18n } from "#i18n";
import TrailLogo from "@ui/components/trail-logo";
import { Card, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";

export function WelcomeStep() {
  return (
    <Card className="animate-in fade-in-0 slide-in-from-right-2 items-center gap-5 border-none bg-transparent py-0 text-center ring-0 duration-300">
      {/* The logo itself is the demo — it literally animates the graph metaphor */}
      <div className="animate-in fade-in-0 zoom-in-95 relative duration-500">
        <TrailLogo animated variant="field" className="trail-logo-hero" label="Trail" />
      </div>
      <CardHeader className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both gap-1.5 px-0 duration-500">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {i18n.t("onboarding.welcome.title")}
        </CardTitle>
        <CardDescription className="mx-auto max-w-[300px] text-sm leading-relaxed">
          {i18n.t("onboarding.welcome.body")}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
