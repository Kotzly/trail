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
        <SectionHeader eyebrow={i18n.t("settings.privacy.recordsTitle")} />
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
