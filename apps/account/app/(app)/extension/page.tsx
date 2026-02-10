import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuthSession } from "@/src/lib/auth";
import { ensureUser } from "@/src/server/user";
import { createExtensionLoginCode } from "@/src/server/extension-login";
import { getAccountUsageSnapshot } from "@/src/server/account-usage";
import {
  formatDeviceLastSeen,
  formatDeviceLocation,
  formatDeviceName,
} from "@/src/server/device-presentation";

export const runtime = "nodejs";

type ExtensionPageProps = {
  searchParams: Promise<{
    code?: string;
  }>;
};

export default async function ExtensionPage({
  searchParams,
}: ExtensionPageProps) {
  const resolvedSearchParams = await searchParams;
  const queryCode =
    typeof resolvedSearchParams?.code === "string"
      ? resolvedSearchParams.code
      : null;
  const returnTo = queryCode ? `/extension?code=${queryCode}` : "/extension";
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(`/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  const user = session.user ? await ensureUser(session.user) : null;
  if (!user) {
    redirect(`/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  let connectionReady = false;

  if (queryCode && user) {
    try {
      const stored = await createExtensionLoginCode(user.id, queryCode);
      if (stored !== queryCode) {
        redirect(`/extension?code=${stored}`);
      }
      connectionReady = true;
    } catch {
      const newCode = await createExtensionLoginCode(user.id);
      redirect(`/extension?code=${newCode}`);
    }
  }

  // Portal flow just completed — show a simple success message.
  // The extension is polling and will pick up the approved status automatically.
  if (connectionReady) {
    return (
      <section className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            You&apos;re all set
          </h1>
          <p className="text-sm text-muted-foreground">
            You can close this tab and return to the extension.
            <br />
            Trail will sync automatically.
          </p>
        </div>
      </section>
    );
  }

  const usage = await getAccountUsageSnapshot();
  const sessions = usage.devices;
  const isConnected = sessions.length > 0;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">extension</h1>
        <p className="text-sm text-muted-foreground">
          connect your browser to sync trails.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>status</CardTitle>
          <CardDescription>
            {isConnected ? "connected" : "not connected"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {isConnected
              ? `${sessions.length} device${sessions.length === 1 ? "" : "s"}`
              : "install the extension to start capturing trails."}
          </div>
          <Button asChild size="sm" variant={isConnected ? "outline" : "default"}>
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noreferrer"
            >
              chrome web store
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>devices</CardTitle>
          <CardDescription>
            sessions currently linked to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>device</TableHead>
                  <TableHead>location</TableHead>
                  <TableHead className="text-right">status</TableHead>
                  <TableHead className="text-right">last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {formatDeviceName(item)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDeviceLocation(item)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.status.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDeviceLastSeen(item)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">no connected devices.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
