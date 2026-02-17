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
import SignOutButton from "@/app/(app)/SignOutButton";
import { AccountSettingsForm } from "./AccountSettingsForm";

export default async function SettingsPage() {
  const { settings } = accountCopy;
  // Auth is guaranteed by the (app) layout — no need to redirect here.
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
        <h1 className="text-xl font-semibold">settings</h1>
        <p className="text-sm text-muted-foreground">
          account profile and security.
        </p>
      </div>

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

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-sm font-medium">sign out</p>
            <p className="text-xs text-muted-foreground">
              end your current session.
            </p>
          </div>
          <SignOutButton />
        </CardContent>
      </Card>
    </section>
  );
}
