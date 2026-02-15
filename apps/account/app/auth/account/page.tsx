import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { splitDisplayName } from "@/src/account-profile";
import { auth } from "@/src/auth";
import { AccountSettingsForm } from "./AccountSettingsForm";

export default async function AccountPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: new Headers(requestHeaders),
  });

  if (!session?.user?.id) {
    redirect(`/login?returnTo=${encodeURIComponent("/auth/account")}`);
  }

  const { firstName, lastName } = splitDisplayName(session.user.name);

  return (
    <AccountSettingsForm
      initialFirstName={firstName}
      initialLastName={lastName}
      initialEmail={session.user.email}
      initialPhotoUrl={session.user.image ?? ""}
    />
  );
}
