import Link from "next/link";
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
import { getAccountUsageSnapshot } from "@/src/server/account-usage";
import { formatDateTime } from "@/src/server/device-presentation";

export default async function DashboardPage() {
  const usage = await getAccountUsageSnapshot();
  const hasTrails = usage.recentTrails.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">trails</h1>
          <p className="text-sm text-muted-foreground">
            saved trails captured by your extension
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/extension">extension</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>recent</CardTitle>
          <CardDescription>
            {hasTrails ? "your latest saved trails" : "no trails yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasTrails ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>name</TableHead>
                  <TableHead>root</TableHead>
                  <TableHead className="text-right">nodes</TableHead>
                  <TableHead className="text-right">saved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.recentTrails.map((trail) => (
                  <TableRow key={trail.id}>
                    <TableCell className="font-medium">{trail.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {trail.rootTitle ?? "Untitled root"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {trail.nodeCount}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDateTime(trail.savedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                install the extension and capture a trail to see it here.
              </p>
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <Link href="/extension">connect extension</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings">account</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
