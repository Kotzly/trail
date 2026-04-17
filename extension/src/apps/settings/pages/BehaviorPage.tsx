import type { Settings, CleanupSettings } from "@shared/types/settings.js";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@ui/components/ui/field";
import { Switch } from "@ui/components/ui/switch";
import { Separator } from "@ui/components/ui/separator";
import { Slider } from "@ui/components/ui/slider";
import { Button } from "@ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
import { Icons } from "@ui/components/icons";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";

type BehaviorPageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

function CleanupInfo({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label="More info"
        >
          <Icons.Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm leading-relaxed">{text}</PopoverContent>
    </Popover>
  );
}

function patchCleanup(
  current: CleanupSettings,
  patch: {
    glance?: Partial<CleanupSettings["glance"]>;
    roundTrip?: Partial<CleanupSettings["roundTrip"]>;
  },
): CleanupSettings {
  return {
    glance: { ...current.glance, ...(patch.glance ?? {}) },
    roundTrip: { ...current.roundTrip, ...(patch.roundTrip ?? {}) },
  };
}

export function BehaviorPage({ settings, onUpdate }: BehaviorPageProps) {
  const cleanup = settings.cleanup;

  const pushCleanup = (patch: Parameters<typeof patchCleanup>[1]) =>
    onUpdate({ cleanup: patchCleanup(cleanup, patch) });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Behavior" description="Customize how Trail works." />

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

      <div className="flex flex-col gap-4">
        <SectionHeader
          title="Auto-cleanup"
          description="Trail quietly removes low-value pages to keep your map readable."
        />
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <div className="flex items-center gap-1">
                <FieldLabel htmlFor="cleanup-glance">Quick-peek pruning</FieldLabel>
                <CleanupInfo text="If you open a page, leave within a few seconds, and never come back, Trail removes it. If you ever return to that URL later, the node comes back automatically." />
              </div>
              <FieldDescription>
                Remove pages you viewed briefly and never returned to.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="cleanup-glance"
              checked={cleanup.glance.enabled}
              onCheckedChange={(v) => pushCleanup({ glance: { enabled: v } })}
            />
          </Field>

          {cleanup.glance.enabled ? (
            <Field>
              <FieldContent>
                <FieldLabel>
                  Threshold · {(cleanup.glance.thresholdMs / 1000).toFixed(0)} s
                </FieldLabel>
                <FieldDescription>
                  Pages viewed under this duration are eligible for pruning.
                </FieldDescription>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={[cleanup.glance.thresholdMs / 1000]}
                  onValueChange={(v) =>
                    pushCleanup({ glance: { thresholdMs: (v[0] ?? 5) * 1000 } })
                  }
                  className="mt-2 max-w-xs"
                />
              </FieldContent>
            </Field>
          ) : null}

          <Separator />

          <Field orientation="horizontal">
            <FieldContent>
              <div className="flex items-center gap-1">
                <FieldLabel htmlFor="cleanup-roundtrip">Round-trip cleanup</FieldLabel>
                <CleanupInfo text="If you click a link and immediately go back without staying, the side-trip is skipped. Useful for accidental clicks and captcha round-trips." />
              </div>
              <FieldDescription>When you visit A → B → A, skip the detour.</FieldDescription>
            </FieldContent>
            <Switch
              id="cleanup-roundtrip"
              checked={cleanup.roundTrip.enabled}
              onCheckedChange={(v) => pushCleanup({ roundTrip: { enabled: v } })}
            />
          </Field>
        </FieldGroup>
      </div>
    </div>
  );
}
