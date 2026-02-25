import Image from "next/image";
import { accountCopy } from "@trail/content";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthSession } from "@/src/lib/auth";
import { splitDisplayName } from "@/src/account-profile";
import { AccountSettingsForm } from "./AccountSettingsForm";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsPage() {
  const { settings } = accountCopy;
  const session = await getAuthSession();
  const user = session!.user;

  const { firstName, lastName } = splitDisplayName(user.name);

  const initialsSource =
    user.name || user.email || settings.profile.fallbackName;
  const initials = initialsSource
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toLowerCase())
    .join("");

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account profile and preferences.
        </p>
      </div>

      <SettingsTabs
        profileContent={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-xs font-semibold">
                    {user.imageUrl ? (
                      <Image
                        unoptimized
                        src={user.imageUrl}
                        alt={user.name ?? settings.profile.avatarAlt}
                        width={40}
                        height={40}
                        sizes="40px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <CardTitle>{user.name ?? settings.profile.fallbackName}</CardTitle>
                    <CardDescription>
                      {user.email ?? settings.profile.fallbackEmail}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AccountSettingsForm
                  initialFirstName={firstName}
                  initialLastName={lastName}
                  initialEmail={user.email ?? ""}
                />
              </CardContent>
            </Card>
          </div>
        }
        appearanceContent={
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Theme preferences are managed by your system settings. Toggle
                dark mode through your OS or browser preferences.
              </p>
            </CardContent>
          </Card>
        }
        dataContent={
          <Card>
            <CardHeader>
              <CardTitle>Data</CardTitle>
              <CardDescription>
                Manage your trail data and account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Export data</p>
                <p className="text-sm text-muted-foreground">
                  Download all your trails and associated data. Coming soon.
                </p>
              </div>
            </CardContent>
          </Card>
        }
      />
    </section>
  );
}
