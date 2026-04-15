import type { Settings, LayoutMode, GraphDensity, TitleTruncation } from "@shared/types/settings.js";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Separator } from "@ui/components/ui/separator";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@ui/components/ui/radio-group";

type AppearancePageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

export function AppearancePage({ settings, onUpdate }: AppearancePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize the graph display
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Layout Mode</Label>
          <RadioGroup
            value={settings.layout.mode}
            onValueChange={(v) =>
              onUpdate({
                layout: { ...settings.layout, mode: v as LayoutMode },
              })
            }
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="tree" id="layout-tree" />
              <Label htmlFor="layout-tree">Tree</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="mindmap" id="layout-mindmap" />
              <Label htmlFor="layout-mindmap">Mind Map</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Density</Label>
          <RadioGroup
            value={settings.graphDensity}
            onValueChange={(v) => onUpdate({ graphDensity: v as GraphDensity })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="compact" id="density-compact" />
              <Label htmlFor="density-compact">Compact</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="comfortable" id="density-comfortable" />
              <Label htmlFor="density-comfortable">Comfortable</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="spacious" id="density-spacious" />
              <Label htmlFor="density-spacious">Spacious</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Title Truncation</Label>
          <Select
            value={settings.titleTruncation}
            onValueChange={(v) => onUpdate({ titleTruncation: v as TitleTruncation })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="start">Start</SelectItem>
                <SelectItem value="middle">Middle</SelectItem>
                <SelectItem value="end">End</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Display</h3>
        <ToggleRow
          label="Show favicons"
          checked={settings.showFavicons}
          onChange={(v) => onUpdate({ showFavicons: v })}
        />
        <ToggleRow
          label="Show URLs"
          checked={settings.showUrls}
          onChange={(v) => onUpdate({ showUrls: v })}
        />
        <ToggleRow
          label="Show connections"
          checked={settings.showConnections}
          onChange={(v) => onUpdate({ showConnections: v })}
        />
        <ToggleRow
          label="Show tab counts"
          checked={settings.showTabCounts}
          onChange={(v) => onUpdate({ showTabCounts: v })}
        />
        <ToggleRow
          label="Dim closed nodes"
          checked={settings.dimClosedNodes}
          onChange={(v) => onUpdate({ dimClosedNodes: v })}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
