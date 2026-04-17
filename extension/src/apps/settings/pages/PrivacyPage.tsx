import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { PageHeader } from "../components/PageHeader.js";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Privacy"
        description="Control what leaves your device. Your browsing tree is always stored locally first."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnostic & usage data</CardTitle>
          <CardDescription>
            Help us improve Trail. We never send URLs, page titles, or tree content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="telemetry-errors">Crash reports</FieldLabel>
                <FieldDescription>
                  Send anonymized error reports via Sentry when Trail crashes.
                </FieldDescription>
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
                <FieldLabel htmlFor="telemetry-analytics">Product analytics</FieldLabel>
                <FieldDescription>
                  Anonymous usage stats (feature opened, action taken) via PostHog. No personal
                  data.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="telemetry-analytics"
                checked={Boolean(consent?.analytics)}
                onCheckedChange={(v) => void updateConsent({ analytics: v })}
                disabled={!consent}
              />
            </Field>

            <FieldDescription>
              Changes take effect when you next open the sidepanel or settings.
            </FieldDescription>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What Trail records</CardTitle>
          <CardDescription>
            Domains Trail should never record. Supports <code>*</code> wildcards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="skip-incognito">Skip incognito windows</FieldLabel>
                <FieldDescription>Don't record navigations in private browsing.</FieldDescription>
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
              <FieldLabel>URL schemes to track</FieldLabel>
              <FieldDescription>
                Trail records pages using these schemes. Defaults to regular web pages only. Add{" "}
                <code>file:</code> to record local files, <code>chrome-extension:</code> for
                extension pages.
              </FieldDescription>
              <PatternListEditor
                values={settings?.privacy.trackedSchemes ?? []}
                disabled={!settings}
                placeholder="chrome-extension:"
                addLabel="Add scheme"
                emptyText="No schemes — nothing will be tracked. Add at least one (e.g. https:)."
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
              <FieldLabel>Blocked hostnames</FieldLabel>
              <FieldDescription>
                Hostnames Trail never records. Supports <code>*</code> wildcards —{" "}
                <code>*.bank.com</code> blocks any subdomain; <code>localhost</code> is an exact
                match.
              </FieldDescription>
              <PatternListEditor
                values={settings?.privacy.blocklist ?? []}
                disabled={!settings}
                placeholder="*.bank.com"
                addLabel="Add pattern"
                emptyText="Nothing blocked. Add a hostname pattern to hide it from your tree."
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
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.privacy)}
          >
            Privacy Policy →
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => openExternal(MARKETING_URLS.terms)}
          >
            Terms of Service →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
