import type { RouteParams } from "../router.js";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/ui/card";

export default function GettingStartedPage(_props: RouteParams) {
  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight">Getting Started</h1>

      <div className="flex flex-col gap-4">
        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-[15px] font-medium">Welcome to Trail</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Trail maps your browsing into a visual tree. Every link you click grows the tree, giving
              you a bird's-eye view of how you explore the web.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-[15px] font-medium">Quick tips</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <ul className="text-[13px] leading-loose text-muted-foreground pl-5">
              <li>Open the side panel to see your trail as you browse</li>
              <li>Click any node to jump back to that page</li>
              <li>Use the spotlight (Cmd/Ctrl + K) to search across all trails</li>
              <li>Archive trails to keep things organized</li>
              <li>Export trails as JSON to share or back up</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-[15px] font-medium">Need help?</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Visit{" "}
              <a
                href="https://gettrail.net/support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground"
              >
                gettrail.net/support
              </a>{" "}
              for documentation and support.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
