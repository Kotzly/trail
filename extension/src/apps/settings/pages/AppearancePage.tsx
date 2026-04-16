import type {
  Settings,
  LayoutMode,
  GraphDensity,
  TitleTruncation,
} from "@shared/types/settings.js";
import { CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ui/components/ui/field";
import { Switch } from "@ui/components/ui/switch";
import { Separator } from "@ui/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@ui/components/ui/radio-group";

type AppearancePageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

export function AppearancePage({ settings, onUpdate }: AppearancePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="px-0">
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize the graph display.</CardDescription>
      </CardHeader>

      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Layout mode</FieldLegend>
          <RadioGroup
            value={settings.layout.mode}
            onValueChange={(v) =>
              onUpdate({ layout: { ...settings.layout, mode: v as LayoutMode } })
            }
            className="flex gap-4"
          >
            <Field orientation="horizontal">
              <RadioGroupItem value="tree" id="layout-tree" />
              <FieldLabel htmlFor="layout-tree">Tree</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem value="mindmap" id="layout-mindmap" />
              <FieldLabel htmlFor="layout-mindmap">Mind map</FieldLabel>
            </Field>
          </RadioGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Density</FieldLegend>
          <RadioGroup
            value={settings.graphDensity}
            onValueChange={(v) => onUpdate({ graphDensity: v as GraphDensity })}
            className="flex gap-4"
          >
            <Field orientation="horizontal">
              <RadioGroupItem value="compact" id="density-compact" />
              <FieldLabel htmlFor="density-compact">Compact</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem value="comfortable" id="density-comfortable" />
              <FieldLabel htmlFor="density-comfortable">Comfortable</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem value="spacious" id="density-spacious" />
              <FieldLabel htmlFor="density-spacious">Spacious</FieldLabel>
            </Field>
          </RadioGroup>
        </FieldSet>

        <Field>
          <FieldLabel htmlFor="title-truncation">Title truncation</FieldLabel>
          <Select
            value={settings.titleTruncation}
            onValueChange={(v) => onUpdate({ titleTruncation: v as TitleTruncation })}
          >
            <SelectTrigger id="title-truncation" className="w-[180px]">
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
        </Field>
      </FieldGroup>

      <Separator />

      <FieldSet>
        <FieldLegend variant="label">Display</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-favicons">Show favicons</FieldLabel>
            </FieldContent>
            <Switch
              id="show-favicons"
              checked={settings.showFavicons}
              onCheckedChange={(v) => onUpdate({ showFavicons: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-urls">Show URLs</FieldLabel>
            </FieldContent>
            <Switch
              id="show-urls"
              checked={settings.showUrls}
              onCheckedChange={(v) => onUpdate({ showUrls: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-connections">Show connections</FieldLabel>
            </FieldContent>
            <Switch
              id="show-connections"
              checked={settings.showConnections}
              onCheckedChange={(v) => onUpdate({ showConnections: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-tab-counts">Show tab counts</FieldLabel>
            </FieldContent>
            <Switch
              id="show-tab-counts"
              checked={settings.showTabCounts}
              onCheckedChange={(v) => onUpdate({ showTabCounts: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="dim-closed-nodes">Dim closed nodes</FieldLabel>
            </FieldContent>
            <Switch
              id="dim-closed-nodes"
              checked={settings.dimClosedNodes}
              onCheckedChange={(v) => onUpdate({ dimClosedNodes: v })}
            />
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}
