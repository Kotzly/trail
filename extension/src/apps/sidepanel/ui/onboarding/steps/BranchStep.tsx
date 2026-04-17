import { BranchDiagram } from "../components/BranchDiagram.js";

export function BranchStep() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-4 duration-300">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-400">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Backtracking doesn&apos;t lose your work.
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Revisit a page, click a new link — Trail branches so you keep both paths.
        </p>
      </div>

      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-75 duration-400">
        <BranchDiagram />
      </div>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both text-xs leading-relaxed delay-150 duration-400">
        Quick glances fade on their own. If you return, they reappear.{" "}
        <span className="text-foreground/70">Tune it in Settings → Behavior.</span>
      </p>
    </div>
  );
}
