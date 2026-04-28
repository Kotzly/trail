import { useQuery, useQueryClient } from "@tanstack/react-query";
import { i18n } from "#i18n";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";
import { Switch } from "@ui/components/ui/switch";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@ui/components/ui/field";
import { Separator } from "@ui/components/ui/separator";
import { Button } from "@ui/components/ui/button";
import {
  getTelemetryConsent,
  setTelemetryConsent,
  captureEvent,
} from "@shared/lib/observability.js";
import type { TelemetryConsent } from "@shared/config/storage-items.js";
import { MARKETING_URLS, openExternal } from "@shared/config/marketing-urls.js";
import { useSettings } from "../hooks/useSettings.js";
import { PatternListEditor } from "../components/PatternListEditor.js";

const normalizeScheme = (raw: string): string => {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return "";
  return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
};

const normalizeHostPattern = (raw: string): string => raw.trim().toLowerCase();

const TELEMETRY_CONSENT_KEY = ["telemetry-consent"] as const;

export function PrivacyPage() {
  const queryClient = useQueryClient();
  const { data: consent } = useQuery({
    queryKey: TELEMETRY_CONSENT_KEY,
    queryFn: getTelemetryConsent,
  });
  const { settings, updateSettings } = useSettings();

  const updateConsent = async (next: Partial<TelemetryConsent>) => {
    await setTelemetryConsent(next);
    const updated = await queryClient.fetchQuery({
      queryKey: TELEMETRY_CONSENT_KEY,
      queryFn: getTelemetryConsent,
    });
    if (next.analytics === false || next.errors === false) {
      captureEvent("telemetry_opted_out", {
        errors: Boolean(updated.errors),
        analytics: Boolean(updated.analytics),
      });
    } else if (next.analytics === true || next.errors === true) {
      captureEvent("telemetry_opted_in", {
        errors: Boolean(updated.errors),
        analytics: Boolean(updated.analytics),
      });
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={i18n.t("settings.privacy.title")}
        description={i18n.t("settings.privacy.description")}
      />

      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={i18n.t("settings.privacy.telemetryTitle")}
          description={i18n.t("settings.privacy.telemetryDescription")}
        />
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="telemetry-errors">
                {i18n.t("settings.privacy.errorsLabel")}
              </FieldLabel>
              <FieldDescription>{i18n.t("settings.privacy.errorsDescription")}</FieldDescription>
            </FieldContent>
            <Switch
              id="telemetry-errors"
              checked={Boolean(consent?.errors)}
              onCheckedChange={(v) => void updateConsent({ errors: v })}
              disabled={!consent}
            />
          </Field>

          <Separator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="telemetry-analytics">
                {i18n.t("settings.privacy.analyticsLabel")}
              </FieldLabel>
              <FieldDescription>{i18n.t("settings.privacy.analyticsDescription")}</FieldDescription>
            </FieldContent>
            <Switch
              id="telemetry-analytics"
              checked={Boolean(consent?.analytics)}
              onCheckedChange={(v) => void updateConsent({ analytics: v })}
              disabled={!consent}
            />
          </Field>

          <FieldDescription>{i18n.t("settings.privacy.consentNote")}</FieldDescription>
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={i18n.t("settings.privacy.recordsTitle")}
          description={
            <>
              {i18n.t("settings.privacy.recordsDescriptionPart1")} <code>*</code>{" "}
              {i18n.t("settings.privacy.recordsDescriptionPart2")} <code>**</code>{" "}
              {i18n.t("settings.privacy.recordsDescriptionPart3")}
            </>
          }
        />
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="skip-incognito">
                {i18n.t("settings.privacy.skipIncognitoLabel")}
              </FieldLabel>
              <FieldDescription>
                {i18n.t("settings.privacy.skipIncognitoDescription")}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="skip-incognito"
              checked={settings?.privacy.skipIncognito ?? true}
              onCheckedChange={(v) => {
                if (!settings) return;
                void updateSettings({
                  ...settings,
                  privacy: { ...settings.privacy, skipIncognito: v },
                });
              }}
              disabled={!settings}
            />
          </Field>

          <Separator />

          <Field>
            <FieldLabel>{i18n.t("settings.privacy.schemesLabel")}</FieldLabel>
            <FieldDescription>
              {i18n.t("settings.privacy.schemesDescriptionPart1")} <code>file:</code>{" "}
              {i18n.t("settings.privacy.schemesDescriptionPart2")} <code>chrome-extension:</code>{" "}
              {i18n.t("settings.privacy.schemesDescriptionPart3")}
            </FieldDescription>
            <PatternListEditor
              values={settings?.privacy.trackedSchemes ?? []}
              disabled={!settings}
              placeholder={i18n.t("settings.privacy.schemesPlaceholder")}
              addLabel={i18n.t("settings.privacy.schemesAddLabel")}
              emptyText={i18n.t("settings.privacy.schemesEmpty")}
              normalize={normalizeScheme}
              onChange={(next) => {
                if (!settings) return;
                void updateSettings({
                  ...settings,
                  privacy: { ...settings.privacy, trackedSchemes: next },
                });
              }}
            />
          </Field>

          <Separator />

          <Field>
            <FieldLabel>{i18n.t("settings.privacy.blocklistLabel")}</FieldLabel>
            <FieldDescription>
              {i18n.t("settings.privacy.blocklistDescriptionIntro")}
            </FieldDescription>
            <BlocklistExamples />
            <PatternListEditor
              values={settings?.privacy.blocklist ?? []}
              disabled={!settings}
              placeholder={i18n.t("settings.privacy.blocklistPlaceholder")}
              addLabel={i18n.t("settings.privacy.blocklistAddLabel")}
              emptyText={i18n.t("settings.privacy.blocklistEmpty")}
              normalize={normalizeHostPattern}
              onChange={(next) => {
                if (!settings) return;
                void updateSettings({
                  ...settings,
                  privacy: { ...settings.privacy, blocklist: next },
                });
              }}
            />
          </Field>

          <Separator />

          <Field>
            <FieldLabel>{i18n.t("settings.privacy.collapseLabel")}</FieldLabel>
            <FieldDescription>
              {i18n.t("settings.privacy.collapseDescription", ["⋯N"])}
            </FieldDescription>
            <PatternListEditor
              values={settings?.privacy.collapselist ?? []}
              disabled={!settings}
              placeholder={i18n.t("settings.privacy.collapsePlaceholder")}
              addLabel={i18n.t("settings.privacy.collapseAddLabel")}
              emptyText={i18n.t("settings.privacy.collapseEmpty")}
              normalize={normalizeHostPattern}
              onChange={(next) => {
                if (!settings) return;
                void updateSettings({
                  ...settings,
                  privacy: { ...settings.privacy, collapselist: next },
                });
              }}
            />
          </Field>
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader eyebrow={i18n.t("settings.privacy.policiesTitle")} />
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.privacy)}
          >
            {i18n.t("settings.privacy.privacyPolicy")}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.terms)}
          >
            {i18n.t("settings.privacy.termsOfService")}
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ─── Glob examples as a definition list ─────────────────────── */

function BlocklistExamples() {
  const rows: ReadonlyArray<readonly [string, React.ReactNode]> = [
    [
      "*.bank.com",
      <>
        {i18n.t("settings.privacy.blocklistExample1")} <code>bank.com</code>
      </>,
    ],
    ["localhost", <>{i18n.t("settings.privacy.blocklistExample2")}</>],
    ["*banking*", <>{i18n.t("settings.privacy.blocklistExample3")}</>],
    [
      "**/admin",
      <>
        {i18n.t("settings.privacy.blocklistExample4")} <code>admin</code>{" "}
        {i18n.t("settings.privacy.blocklistExample4Suffix")}
      </>,
    ],
    [
      "example.com/**",
      <>
        {i18n.t("settings.privacy.blocklistExample5")} <code>example.com</code>
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
