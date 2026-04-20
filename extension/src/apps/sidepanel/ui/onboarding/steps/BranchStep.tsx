import { i18n } from "#i18n";
import { BranchDiagram } from "../components/BranchDiagram.js";

export function BranchStep() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-4 duration-300">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-300">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.branch.title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {i18n.t("onboarding.branch.body")}
        </p>
      </div>

      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300">
        <BranchDiagram />
      </div>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both text-xs leading-relaxed duration-300">
        {i18n.t("onboarding.branch.footnote")}{" "}
        <span className="text-foreground/70">{i18n.t("onboarding.branch.settingsHint")}</span>
      </p>
    </div>
  );
}
