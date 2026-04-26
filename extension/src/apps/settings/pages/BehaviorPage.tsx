import { i18n } from "#i18n";
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
          className="press-feedback text-muted-foreground hover:text-foreground"
          aria-label={i18n.t("settings.behavior.moreInfo")}
        >
          <Icons.Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm leading-relaxed data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)">
        {text}
      </PopoverContent>
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
      <PageHeader
        title={i18n.t("settings.behavior.title")}
        description={i18n.t("settings.behavior.description")}
      />

      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="shortcuts-enabled">
              {i18n.t("settings.behavior.shortcutsLabel")}
            </FieldLabel>
            <FieldDescription>{i18n.t("settings.behavior.shortcutsDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="shortcuts-enabled"
            checked={settings.shortcutsEnabled}
            onCheckedChange={(v) => onUpdate({ shortcutsEnabled: v })}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="confirm-new-tree">
              {i18n.t("settings.behavior.confirmNewTreeLabel")}
            </FieldLabel>
            <FieldDescription>
              {i18n.t("settings.behavior.confirmNewTreeDescription")}
            </FieldDescription>
          </FieldContent>
          <Switch
            id="confirm-new-tree"
            checked={settings.confirmNewTree}
            onCheckedChange={(v) => onUpdate({ confirmNewTree: v })}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="keep-tabs-on-switch">
              {i18n.t("settings.behavior.keepTabsLabel")}
            </FieldLabel>
            <FieldDescription>{i18n.t("settings.behavior.keepTabsDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="keep-tabs-on-switch"
            checked={settings.keepTabsOnSwitch}
            onCheckedChange={(v) => onUpdate({ keepTabsOnSwitch: v })}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="adaptive-performance">
              {i18n.t("settings.behavior.adaptivePerfLabel")}
            </FieldLabel>
            <FieldDescription>
              {i18n.t("settings.behavior.adaptivePerfDescription")}
            </FieldDescription>
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
          title={i18n.t("settings.behavior.cleanupTitle")}
          description={i18n.t("settings.behavior.cleanupDescription")}
        />
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <div className="flex items-center gap-1">
                <FieldLabel htmlFor="cleanup-glance">
                  {i18n.t("settings.behavior.glanceLabel")}
                </FieldLabel>
                <CleanupInfo text={i18n.t("settings.behavior.glanceTooltip")} />
              </div>
              <FieldDescription>{i18n.t("settings.behavior.glanceDescription")}</FieldDescription>
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
                  {i18n.t("settings.behavior.thresholdLabel", [
                    (cleanup.glance.thresholdMs / 1000).toFixed(0),
                  ])}
                </FieldLabel>
                <FieldDescription>
                  {i18n.t("settings.behavior.thresholdDescription")}
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
                <FieldLabel htmlFor="cleanup-roundtrip">
                  {i18n.t("settings.behavior.roundTripLabel")}
                </FieldLabel>
                <CleanupInfo text={i18n.t("settings.behavior.roundTripTooltip")} />
              </div>
              <FieldDescription>
                {i18n.t("settings.behavior.roundTripDescription")}
              </FieldDescription>
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
