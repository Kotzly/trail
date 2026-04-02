import { getAuthSession } from "@/src/lib/auth";
import { getUserById } from "@/src/server/backend/user";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResetOnboardingButton } from "./reset-onboarding-button";

export const metadata = {
  title: "Settings",
};

function planLabel(planId: string): string {
  switch (planId) {
    case "pro":
      return "Pro";
    case "teams":
      return "Teams";
    default:
      return "Free";
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
    case "trialing":
      return "default";
    case "past_due":
      return "destructive";
    default:
      return "secondary";
  }
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

export default async function SettingsPage() {
  const session = await getAuthSession();
  if (!session) return null;

  const [user, snapshot] = await Promise.all([
    getUserById(session.user.id),
    getSubscriptionSnapshotForUser({
      userId: session.user.id,
    }),
  ]);

  const memberSince = user?.createdAt
    ? user.createdAt.toLocaleDateString("en", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {session.user.imageUrl && (
              <AvatarImage
                src={session.user.imageUrl}
                alt={session.user.name ?? ""}
              />
            )}
            <AvatarFallback className="text-sm font-medium">
              {getInitials(session.user.name, session.user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1 min-w-0">
            {session.user.name && (
              <p className="font-medium truncate">{session.user.name}</p>
            )}
            {session.user.email && (
              <p className="text-sm text-muted-foreground truncate">
                {session.user.email}
              </p>
            )}
            {memberSince && (
              <p className="text-xs text-muted-foreground">
                Member since {memberSince}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
          <CardDescription>Your current plan and status.</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot ? (
            <div className="flex items-center gap-3">
              <span className="font-medium">{planLabel(snapshot.planId)}</span>
              <Badge variant={statusVariant(snapshot.status)}>
                {snapshot.status === "trialing" ? "Trial" : snapshot.status}
              </Badge>
              {snapshot.cancelAtPeriodEnd && snapshot.currentPeriodEnd && (
                <span className="text-sm text-muted-foreground">
                  Cancels{" "}
                  {new Date(snapshot.currentPeriodEnd).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Free plan</span>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Manage your subscription on the{" "}
          <a href="/billing" className="underline underline-offset-2 ml-1">
            Billing page
          </a>
          .
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-destructive">
            Danger Zone
          </h2>
          <Separator />
        </div>
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base">Reset onboarding</CardTitle>
            <CardDescription>
              Clear the onboarding completion flag so it shows again on next
              login. Useful for testing.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <ResetOnboardingButton />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
