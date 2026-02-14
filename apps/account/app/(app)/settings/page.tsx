import { redirect } from "next/navigation";
import Image, { type ImageLoaderProps } from "next/image";
import { accountCopy } from "@trail/content";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthSession } from "@/src/lib/auth";
import SignOutButton from "@/app/(app)/SignOutButton";

const avatarLoader = ({ src }: ImageLoaderProps) => src;

export default async function SettingsPage() {
  const { settings } = accountCopy;
  const session = await getAuthSession();
  const user = session?.user;

  if (!user) {
    redirect("/auth/login");
  }

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
        <p className="text-sm text-muted-foreground">account profile and security.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>account</CardTitle>
          <CardDescription>{user.email ?? settings.profile.fallbackEmail}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-xs font-semibold">
              {user.imageUrl ? (
                <Image
                  loader={avatarLoader}
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
            <div className="leading-tight">
              <div className="text-sm font-medium">{user.name ?? settings.profile.fallbackName}</div>
              <div className="text-xs text-muted-foreground">
                {user.email ?? settings.profile.fallbackEmail}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/auth/account">
                manage
              </a>
            </Button>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
