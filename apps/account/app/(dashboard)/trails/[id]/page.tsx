import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuthSession } from "@/src/lib/auth";
import { getTrailById } from "@/src/server/trails";
import { ChevronRight } from "lucide-react";
import { TrailDetail } from "./trail-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) return {};

  const trail = await getTrailById(id);
  if (!trail) return { title: "Trail not found" };

  return { title: trail.label };
}

export default async function TrailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session) return null;

  const trail = await getTrailById(id);
  if (!trail) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/trails" className="hover:text-foreground transition-colors">
          Trails
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" />
        <span className="text-foreground font-medium truncate max-w-xs">
          {trail.label}
        </span>
      </nav>

      <TrailDetail trail={trail} />
    </div>
  );
}
