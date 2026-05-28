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
import { PatternListEditor } from "../components/PatternListEditor.js";

type BehaviorPageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

const normalizeScheme = (raw: string): string => {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return "";
  return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
};

const normalizeHostPattern = (raw: string): string => raw.trim().toLowerCase();

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
    <div className="flex flex-col gap-10">
      <PageHeader
        title={i18n.t("settings.behavior.title")}
        description={i18n.t("settings.behavior.description")}
      />

      <section className="flex flex-col gap-4">
        <SectionHeader eyebrow={i18n.t("settings.behavior.generalEyebrow")} />
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="shortcuts-enabled">
                {i18n.t("settings.behavior.shortcutsLabel")}
              </FieldLabel>
              <FieldDescription>
                {i18n.t("settings.behavior.shortcutsDescription")}
              </FieldDescription>
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
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={i18n.t("settings.behavior.cleanupTitle")}
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
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={i18n.t("settings.behavior.urlFilteringTitle")}
          description={
            <>
              {i18n.t("settings.behavior.urlFilteringDescriptionPart1")} <code>*</code>{" "}
              {i18n.t("settings.behavior.urlFilteringDescriptionPart2")} <code>**</code>{" "}
              {i18n.t("settings.behavior.urlFilteringDescriptionPart3")}
            </>
          }
        />
        <FieldGroup>
          <Field>
            <FieldLabel>{i18n.t("settings.behavior.schemesLabel")}</FieldLabel>
            <FieldDescription>
              {i18n.t("settings.behavior.schemesDescriptionPart1")} <code>file:</code>{" "}
              {i18n.t("settings.behavior.schemesDescriptionPart2")}{" "}
              <code>{import.meta.env.FIREFOX ? "moz-extension:" : "chrome-extension:"}</code>{" "}
              {i18n.t("settings.behavior.schemesDescriptionPart3")}
            </FieldDescription>
            <PatternListEditor
              values={settings.privacy.trackedSchemes}
              placeholder={i18n.t("settings.behavior.schemesPlaceholder")}
              addLabel={i18n.t("settings.behavior.schemesAddLabel")}
              emptyText={i18n.t("settings.behavior.schemesEmpty")}
              normalize={normalizeScheme}
              onChange={(next) =>
                onUpdate({
                  privacy: { ...settings.privacy, trackedSchemes: next },
                })
              }
            />
          </Field>

          <Separator />

          <Field>
            <FieldLabel>{i18n.t("settings.behavior.blocklistLabel")}</FieldLabel>
            <FieldDescription>
              {i18n.t("settings.behavior.blocklistDescriptionIntro")}
            </FieldDescription>
            <BlocklistExamples />
            <PatternListEditor
              values={settings.privacy.blocklist}
              placeholder={i18n.t("settings.behavior.blocklistPlaceholder")}
              addLabel={i18n.t("settings.behavior.blocklistAddLabel")}
              emptyText={i18n.t("settings.behavior.blocklistEmpty")}
              normalize={normalizeHostPattern}
              onChange={(next) =>
                onUpdate({
                  privacy: { ...settings.privacy, blocklist: next },
                })
              }
            />
          </Field>

          <Separator />

          <Field>
            <FieldLabel>{i18n.t("settings.behavior.collapseLabel")}</FieldLabel>
            <FieldDescription>
              {i18n.t("settings.behavior.collapseDescription", ["⋯N"])}
            </FieldDescription>
            <PatternListEditor
              values={settings.privacy.collapselist}
              placeholder={i18n.t("settings.behavior.collapsePlaceholder")}
              addLabel={i18n.t("settings.behavior.collapseAddLabel")}
              emptyText={i18n.t("settings.behavior.collapseEmpty")}
              normalize={normalizeHostPattern}
              onChange={(next) =>
                onUpdate({
                  privacy: { ...settings.privacy, collapselist: next },
                })
              }
            />
          </Field>
        </FieldGroup>
      </section>
    </div>
  );
}

function BlocklistExamples() {
  const rows: ReadonlyArray<readonly [string, React.ReactNode]> = [
    [
      "*.bank.com",
      <>
        {i18n.t("settings.behavior.blocklistExample1")} <code>bank.com</code>
      </>,
    ],
    ["localhost", <>{i18n.t("settings.behavior.blocklistExample2")}</>],
    ["*banking*", <>{i18n.t("settings.behavior.blocklistExample3")}</>],
    [
      "**/admin",
      <>
        {i18n.t("settings.behavior.blocklistExample4")} <code>admin</code>{" "}
        {i18n.t("settings.behavior.blocklistExample4Suffix")}
      </>,
    ],
    [
      "example.com/**",
      <>
        {i18n.t("settings.behavior.blocklistExample5")} <code>example.com</code>
      </>,
    ],
  ];

  return (
    <dl className="text-muted-foreground grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs leading-relaxed">
      {rows.map(([pattern, desc]) => (
        <div key={pattern} className="contents">
          <dt>
            <code>{pattern}</code>
          </dt>
          <dd>{desc}</dd>
        </div>
      ))}
    </dl>
  );
}
