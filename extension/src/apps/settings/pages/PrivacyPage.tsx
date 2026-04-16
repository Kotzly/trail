import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
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
import { Textarea } from "@ui/components/ui/textarea";
import {
  getTelemetryConsent,
  setTelemetryConsent,
  captureEvent,
} from "@shared/lib/observability.js";
import type { TelemetryConsent } from "@shared/config/storage-items.js";
import { useSettings } from "../hooks/useSettings.js";

const PRIVACY_URL = "https://gettrail.net/privacy";
const TERMS_URL = "https://gettrail.net/terms";

export function PrivacyPage() {
  const [consent, setConsent] = useState<TelemetryConsent | null>(null);
  const { settings, updateSettings } = useSettings();
  const [blocklistDraft, setBlocklistDraft] = useState<string>("");

  useEffect(() => {
    if (settings) setBlocklistDraft(settings.privacy.blocklist.join("\n"));
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    void getTelemetryConsent().then((c) => {
      if (!cancelled) setConsent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateConsent = async (next: Partial<TelemetryConsent>) => {
    await setTelemetryConsent(next);
    const updated = await getTelemetryConsent();
    setConsent(updated);
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
    <div className="flex flex-col gap-4">
      <CardHeader className="px-0">
        <CardTitle>Privacy</CardTitle>
        <CardDescription>
          Control what leaves your device. Your browsing tree is always stored locally first.
        </CardDescription>
      </CardHeader>

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
              <FieldLabel htmlFor="blocklist">Blocked hostnames</FieldLabel>
              <FieldDescription>
                One pattern per line. <code>*.bank.com</code> blocks any subdomain;{" "}
                <code>localhost</code> is an exact match.
              </FieldDescription>
              <Textarea
                id="blocklist"
                value={blocklistDraft}
                onChange={(e) => setBlocklistDraft(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                spellCheck={false}
                placeholder="*.bank.com&#10;localhost&#10;127.0.0.1"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!settings}
                  onClick={() => {
                    if (!settings) return;
                    const patterns = blocklistDraft
                      .split("\n")
                      .map((p) => p.trim())
                      .filter((p) => p.length > 0);
                    void updateSettings({
                      ...settings,
                      privacy: { ...settings.privacy, blocklist: patterns },
                    });
                  }}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!settings}
                  onClick={() => {
                    if (!settings) return;
                    setBlocklistDraft(settings.privacy.blocklist.join("\n"));
                  }}
                >
                  Reset
                </Button>
              </div>
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
            onClick={() => window.open(PRIVACY_URL, "_blank")}
          >
            Privacy Policy →
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => window.open(TERMS_URL, "_blank")}
          >
            Terms of Service →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
