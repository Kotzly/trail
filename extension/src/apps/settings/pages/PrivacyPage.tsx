import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Switch } from "@ui/components/ui/switch";
import { Label } from "@ui/components/ui/label";
import { Separator } from "@ui/components/ui/separator";
import { Button } from "@ui/components/ui/button";
import {
  getTelemetryConsent,
  setTelemetryConsent,
  captureEvent,
} from "@shared/lib/observability.js";
import type { TelemetryConsent } from "@shared/config/storage-items.js";

const PRIVACY_URL = "https://gettrail.net/privacy";
const TERMS_URL = "https://gettrail.net/terms";

export function PrivacyPage() {
  const [consent, setConsent] = useState<TelemetryConsent | null>(null);

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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Privacy</h2>
        <p className="text-muted-foreground text-sm">
          Control what leaves your device. Your browsing tree is always stored locally first.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnostic & usage data</CardTitle>
          <CardDescription>
            Help us improve Trail. We never send URLs, page titles, or tree content.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="telemetry-errors" className="text-sm font-medium">
                Crash reports
              </Label>
              <p className="text-muted-foreground text-xs">
                Send anonymized error reports via Sentry when Trail crashes.
              </p>
            </div>
            <Switch
              id="telemetry-errors"
              checked={Boolean(consent?.errors)}
              onCheckedChange={(v) => void updateConsent({ errors: v })}
              disabled={!consent}
            />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="telemetry-analytics" className="text-sm font-medium">
                Product analytics
              </Label>
              <p className="text-muted-foreground text-xs">
                Anonymous usage stats (feature opened, action taken) via PostHog. No personal data.
              </p>
            </div>
            <Switch
              id="telemetry-analytics"
              checked={Boolean(consent?.analytics)}
              onCheckedChange={(v) => void updateConsent({ analytics: v })}
              disabled={!consent}
            />
          </div>

          <p className="text-muted-foreground text-xs">
            Changes take effect when you next open the sidepanel or settings.
          </p>
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
