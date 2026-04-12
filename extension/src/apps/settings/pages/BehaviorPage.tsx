import type { Settings } from "@shared/types/settings.js";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";

type BehaviorPageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

export function BehaviorPage({ settings, onUpdate }: BehaviorPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Behavior</h2>
        <p className="text-sm text-muted-foreground">
          Customize how Trail works
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Keyboard shortcuts</Label>
            <p className="text-xs text-muted-foreground">
              Enable keyboard shortcuts in the side panel
            </p>
          </div>
          <Switch
            checked={settings.shortcutsEnabled}
            onCheckedChange={(v) => onUpdate({ shortcutsEnabled: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Confirm new tree</Label>
            <p className="text-xs text-muted-foreground">
              Ask for confirmation before creating a new tree
            </p>
          </div>
          <Switch
            checked={settings.confirmNewTree}
            onCheckedChange={(v) => onUpdate({ confirmNewTree: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Keep tabs on switch</Label>
            <p className="text-xs text-muted-foreground">
              Keep open tabs when switching trees
            </p>
          </div>
          <Switch
            checked={settings.keepTabsOnSwitch}
            onCheckedChange={(v) => onUpdate({ keepTabsOnSwitch: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Adaptive performance</Label>
            <p className="text-xs text-muted-foreground">
              Automatically adjust rendering quality
            </p>
          </div>
          <Switch
            checked={settings.adaptivePerformance}
            onCheckedChange={(v) => onUpdate({ adaptivePerformance: v })}
          />
        </div>
      </div>
    </div>
  );
}
