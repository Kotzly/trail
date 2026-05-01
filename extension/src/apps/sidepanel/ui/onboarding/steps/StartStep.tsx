import { i18n } from "#i18n";
import { Icons } from "@ui/components/icons";
import { StartCard } from "../components/StartCard.js";

type StartStepProps = {
  onLoadDemo: () => void;
  onStartFresh: () => void;
  loadingDemo: boolean;
  disabled: boolean;
};

export function StartStep({ onLoadDemo, onStartFresh, loadingDemo, disabled }: StartStepProps) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-4 duration-300">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-300">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.start.title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {i18n.t("onboarding.start.body")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300">
          <StartCard
            title={i18n.t("onboarding.start.demoTitle")}
            description={i18n.t("onboarding.start.demoBody")}
            icon={<Icons.ListTree className="size-5" />}
            onSelect={onLoadDemo}
            loading={loadingDemo}
            disabled={disabled}
            emphasis="primary"
          />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300">
          <StartCard
            title={i18n.t("onboarding.start.freshTitle")}
            description={i18n.t("onboarding.start.freshBody")}
            icon={<Icons.Plus className="size-5" />}
            onSelect={onStartFresh}
            disabled={disabled || loadingDemo}
          />
        </div>
      </div>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both text-[11px] duration-300">
        {i18n.t("onboarding.start.footnote")}
      </p>
    </div>
  );
}
