import { useState, useMemo } from "react";
import type { RouteParams } from "../router.js";
import { useLocalTrails, type LocalTrailSummary } from "../hooks/useLocalTrails.js";
import TrailCard from "../components/TrailCard.js";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { Card } from "@ui/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";
import { Search } from "lucide-react";

type SortOption = "newest" | "oldest" | "name" | "nodes";

function sortTrails(trails: LocalTrailSummary[], sort: SortOption): LocalTrailSummary[] {
  return [...trails].sort((a, b) => {
    switch (sort) {
      case "newest":
        return b.savedAt - a.savedAt;
      case "oldest":
        return a.savedAt - b.savedAt;
      case "name":
        return a.label.localeCompare(b.label);
      case "nodes":
        return b.nodeCount - a.nodeCount;
    }
  });
}

export default function TrailsPage(_props: RouteParams) {
  const { trails, isLoading, error } = useLocalTrails();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? trails.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            (t.rootTitle?.toLowerCase().includes(q) ?? false) ||
            (t.rootUrl?.toLowerCase().includes(q) ?? false),
        )
      : trails;
    return sortTrails(base, sort);
  }, [trails, search, sort]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Trails</h1>
        </div>
        <Card className="items-center gap-2 py-12 px-6 border-dashed text-center">
          <p className="text-[13px] text-muted-foreground">Loading trails...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Trails</h1>
        </div>
        <Alert variant="destructive" className="border-destructive">
          <AlertDescription className="text-[13px]">Failed to load trails: {error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (trails.length === 0) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Trails</h1>
          <Button variant="outline" asChild>
            <a href="#/trails/import">Import</a>
          </Button>
        </div>
        <Card className="items-center gap-2 py-12 px-6 border-dashed text-center">
          <p className="text-sm font-medium text-foreground m-0">No trails yet</p>
          <p className="text-[13px] text-muted-foreground max-w-[300px] m-0">
            Start browsing with the Trail extension and your trails will appear here automatically.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Trails</h1>
        <Button variant="outline" asChild>
          <a href="#/trails/import">Import</a>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-3.5" />
          <Input
            type="text"
            placeholder="Search trails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-[34px] text-[13px]"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="h-[34px] text-[13px] w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="nodes">Most nodes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {filtered.map((trail) => (
            <TrailCard key={trail.id} trail={trail} />
          ))}
        </div>
      ) : (
        <Card className="items-center gap-2 py-12 px-6 border-dashed text-center">
          <p className="text-sm font-medium text-foreground m-0">No matching trails</p>
          <p className="text-[13px] text-muted-foreground m-0">Try adjusting your search query.</p>
        </Card>
      )}
    </div>
  );
}
