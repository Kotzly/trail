import Link from "next/link";
import { TreePine, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrailNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center p-6">
      <TreePine className="h-12 w-12 text-muted-foreground/40" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Trail not found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This trail doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/trails">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to trails
        </Link>
      </Button>
    </div>
  );
}
