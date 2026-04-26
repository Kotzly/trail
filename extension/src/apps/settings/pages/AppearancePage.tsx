import { i18n } from "#i18n";
import type {
  Settings,
  LayoutMode,
  GraphDensity,
  TitleTruncation,
} from "@shared/types/settings.js";
import type { ThemeId } from "@shared/types/theme.js";
import { THEME_PRESETS } from "@shared/styles/theme-presets.js";
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
      <PageHeader
        title={i18n.t("settings.appearance.title")}
        description={i18n.t("settings.appearance.description")}
      />

      <div className="flex flex-col gap-4">
        <SectionHeader
          title={i18n.t("settings.appearance.themeTitle")}
          description={i18n.t("settings.appearance.themeDescription")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="theme-mode">{i18n.t("settings.appearance.modeLabel")}</FieldLabel>
            <Select value={settings.theme} onValueChange={(v) => onUpdate({ theme: v as ThemeId })}>
              <SelectTrigger id="theme-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={6}
                className="data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)"
              >
                <SelectGroup>
                  <SelectItem value="light">{i18n.t("settings.appearance.modeLight")}</SelectItem>
                  <SelectItem value="dark">{i18n.t("settings.appearance.modeDark")}</SelectItem>
                  <SelectItem value="system">{i18n.t("settings.appearance.modeSystem")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="theme-preset">
              {i18n.t("settings.appearance.themePresetLabel")}
            </FieldLabel>
            <Select
              value={settings.themePreset}
              onValueChange={(v) => onUpdate({ themePreset: v })}
            >
              <SelectTrigger id="theme-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={6}
                className="data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)"
              >
                <SelectGroup>
                  {THEME_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="flex shrink-0 -space-x-1">
                          {p.swatch.map((color, i) => (
                            <span
                              key={i}
                              className="border-border ring-background inline-block size-3 rounded-full border ring-1"
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="layout-mode">{i18n.t("settings.appearance.layoutLabel")}</FieldLabel>
          <Select
            value={settings.layout.mode}
            onValueChange={(v) =>
              onUpdate({ layout: { ...settings.layout, mode: v as LayoutMode } })
            }
          >
            <SelectTrigger id="layout-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={6}
              className="data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)"
            >
              <SelectGroup>
                <SelectItem value="tree">{i18n.t("settings.appearance.layoutTree")}</SelectItem>
                <SelectItem value="mindmap">
                  {i18n.t("settings.appearance.layoutMindmap")}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="graph-density">
            {i18n.t("settings.appearance.densityLabel")}
          </FieldLabel>
          <Select
            value={settings.graphDensity}
            onValueChange={(v) => onUpdate({ graphDensity: v as GraphDensity })}
          >
            <SelectTrigger id="graph-density" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={6}
              className="data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)"
            >
              <SelectGroup>
                <SelectItem value="compact">
                  {i18n.t("settings.appearance.densityCompact")}
                </SelectItem>
                <SelectItem value="comfortable">
                  {i18n.t("settings.appearance.densityComfortable")}
                </SelectItem>
                <SelectItem value="spacious">
                  {i18n.t("settings.appearance.densitySpacious")}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="title-truncation">
            {i18n.t("settings.appearance.truncationLabel")}
          </FieldLabel>
          <Select
            value={settings.titleTruncation}
            onValueChange={(v) => onUpdate({ titleTruncation: v as TitleTruncation })}
          >
            <SelectTrigger id="title-truncation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={6}
              className="data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)"
            >
              <SelectGroup>
                <SelectItem value="start">
                  {i18n.t("settings.appearance.truncationStart")}
                </SelectItem>
                <SelectItem value="middle">
                  {i18n.t("settings.appearance.truncationMiddle")}
                </SelectItem>
                <SelectItem value="end">{i18n.t("settings.appearance.truncationEnd")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeader
          title={i18n.t("settings.appearance.displayTitle")}
          description={i18n.t("settings.appearance.displayDescription")}
        />
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-favicons">
                {i18n.t("settings.appearance.showFavicons")}
              </FieldLabel>
            </FieldContent>
            <Switch
              id="show-favicons"
              checked={settings.showFavicons}
              onCheckedChange={(v) => onUpdate({ showFavicons: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-urls">{i18n.t("settings.appearance.showUrls")}</FieldLabel>
            </FieldContent>
            <Switch
              id="show-urls"
              checked={settings.showUrls}
              onCheckedChange={(v) => onUpdate({ showUrls: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-connections">
                {i18n.t("settings.appearance.showConnections")}
              </FieldLabel>
            </FieldContent>
            <Switch
              id="show-connections"
              checked={settings.showConnections}
              onCheckedChange={(v) => onUpdate({ showConnections: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="show-tab-counts">
                {i18n.t("settings.appearance.showTabCounts")}
              </FieldLabel>
            </FieldContent>
            <Switch
              id="show-tab-counts"
              checked={settings.showTabCounts}
              onCheckedChange={(v) => onUpdate({ showTabCounts: v })}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="dim-closed-nodes">
                {i18n.t("settings.appearance.dimClosedNodes")}
              </FieldLabel>
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
