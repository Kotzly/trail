import type { Settings } from "@shared/types/settings.js";
import { CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@ui/components/ui/field";
import { Switch } from "@ui/components/ui/switch";

type BehaviorPageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

export function BehaviorPage({ settings, onUpdate }: BehaviorPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="px-0">
        <CardTitle>Behavior</CardTitle>
        <CardDescription>Customize how Trail works.</CardDescription>
      </CardHeader>

      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="shortcuts-enabled">Keyboard shortcuts</FieldLabel>
            <FieldDescription>Enable keyboard shortcuts in the side panel.</FieldDescription>
          </FieldContent>
          <Switch
            id="shortcuts-enabled"
            checked={settings.shortcutsEnabled}
            onCheckedChange={(v) => onUpdate({ shortcutsEnabled: v })}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="confirm-new-tree">Confirm new tree</FieldLabel>
            <FieldDescription>Ask for confirmation before creating a new tree.</FieldDescription>
          </FieldContent>
          <Switch
            id="confirm-new-tree"
            checked={settings.confirmNewTree}
            onCheckedChange={(v) => onUpdate({ confirmNewTree: v })}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="keep-tabs-on-switch">Keep tabs on switch</FieldLabel>
            <FieldDescription>Keep open tabs when switching trees.</FieldDescription>
          </FieldContent>
          <Switch
            id="keep-tabs-on-switch"
            checked={settings.keepTabsOnSwitch}
            onCheckedChange={(v) => onUpdate({ keepTabsOnSwitch: v })}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="adaptive-performance">Adaptive performance</FieldLabel>
            <FieldDescription>Automatically adjust rendering quality.</FieldDescription>
          </FieldContent>
          <Switch
            id="adaptive-performance"
            checked={settings.adaptivePerformance}
            onCheckedChange={(v) => onUpdate({ adaptivePerformance: v })}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}
