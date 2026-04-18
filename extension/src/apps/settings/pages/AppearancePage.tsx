import type {
  Settings,
  LayoutMode,
  GraphDensity,
  TitleTruncation,
} from "@shared/types/settings.js";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@ui/components/ui/field";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";
import { Switch } from "@ui/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/ui/select";

type AppearancePageProps = {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
};

export function AppearancePage({ settings, onUpdate }: AppearancePageProps) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Appearance" description="Customize how the graph looks." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="layout-mode">Layout mode</FieldLabel>
          <Select
            value={settings.layout.mode}
            onValueChange={(v) =>
              onUpdate({ layout: { ...settings.layout, mode: v as LayoutMode } })
            }
          >
            <SelectTrigger id="layout-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="tree">Tree</SelectItem>
                <SelectItem value="mindmap">Mind map</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="graph-density">Density</FieldLabel>
          <Select
            value={settings.graphDensity}
            onValueChange={(v) => onUpdate({ graphDensity: v as GraphDensity })}
          >
            <SelectTrigger id="graph-density" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="spacious">Spacious</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="title-truncation">Title truncation</FieldLabel>
          <Select
            value={settings.titleTruncation}
            onValueChange={(v) => onUpdate({ titleTruncation: v as TitleTruncation })}
          >
            <SelectTrigger id="title-truncation" className="w-full">
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
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeader title="Display" description="Decide how much detail each node shows." />
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
      </div>
    </div>
  );
}
