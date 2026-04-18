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
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-400">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Start with something real, or start empty.
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Either works. You can always switch trees later.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-75 duration-400">
          <StartCard
            title="Load the Japan demo tree"
            description="~25 nodes you can pan, collapse, and edit."
            icon={<Icons.ListTree className="size-5" />}
            onSelect={onLoadDemo}
            loading={loadingDemo}
            disabled={disabled}
            emphasis="primary"
          />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-125 duration-400">
          <StartCard
            title="Start fresh"
            description="Your next click becomes the first node."
            icon={<Icons.Plus className="size-5" />}
            onSelect={onStartFresh}
            disabled={disabled || loadingDemo}
          />
        </div>
      </div>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both text-[11px] delay-200 duration-400">
        Your current tree (if any) stays saved — you can switch back from the sidepanel.
      </p>
    </div>
  );
}
