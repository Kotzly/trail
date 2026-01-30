# Extension: Theme Picker

**Scope:** `extension/` — Chrome/Brave extension sidepanel  
**Purpose:** Custom theme editor (light/dark/system + color palette) with live preview and debounced save.

---

## File Map

| Role | Path |
|------|------|
| Panel (modal + state) | `extension/src/sidepanel/ui/components/theme/ThemePanel.tsx` |
| Palette UI (dots, presets, sliders) | `extension/src/sidepanel/ui/components/theme/ThemePalette.tsx` |
| Preset definitions | `extension/src/sidepanel/ui/components/theme/theme-presets.ts` |
| Apply to DOM | `extension/src/sidepanel/ui/shared/apply-theme.ts` |
| Token generation | `extension/src/sidepanel/ui/shared/theme-generator.ts` |
| Theme id/labels | `extension/src/sidepanel/ui/shared/themes.ts` |
| Settings type | `extension/src/shared/types/settings.ts` |

---

## Interfaces & Types

### Settings (from `shared/types/settings.ts`)

```ts
type ThemeId = 'light' | 'dark' | 'system';

type ThemeDotType = 'explicit-lightness' | 'explicit-black-white';

type ThemeHarmony =
  | 'floating'
  | 'complementary'
  | 'singleAnalogous'
  | 'splitComplementary'
  | 'analogous'
  | 'triadic';

type ThemeDot = {
  x: number;   // 0..1
  y: number;   // 0..1
  type?: ThemeDotType;
};

type CustomTheme = {
  enabled: boolean;
  dots: ThemeDot[];
  harmony: ThemeHarmony;
  lightness: number;
  opacity: number;
  texture: number;
  customColors: string[];
  accentColor: string | null;
};

type Settings = {
  theme: ThemeId;
  customTheme: CustomTheme;
  // ... other fields
};
```

### Theme (from `shared/themes.ts`)

```ts
type Theme = { id: ThemeId; label: string; icon: string; };
// THEMES: Record<ThemeId, Theme>, DEFAULT_THEME: ThemeId
```

### ThemePalette props

```ts
type ThemePaletteProps = {
  scheme: ThemeId;
  value: CustomTheme;
  onSchemeChange: (scheme: ThemeId) => void;
  onPreview: (next: CustomTheme) => void;
  onCommit: (next: CustomTheme) => void;
};
```

---

## Design Patterns

1. **Draft vs committed**  
   Panel holds `draftTheme`; `onPreview` runs live (RAF) without persisting; `onCommit` updates store and triggers debounced `saveSettings`.

2. **Debounced save**  
   `scheduleSave(nextSettings)` waits 240ms then `flushPendingSave()`. On panel close, `flushPendingSave()` is called immediately.

3. **Portal**  
   Theme panel is rendered with `createPortal(..., document.body)` and uses overlay + `theme-panel` container. Click outside or Escape closes and commits last preview.

4. **Overlay effects**  
   `useOverlayEffects(isMounted, { lod: true, blur: true, kind: 'modal' })` toggles LOD/blur on the graph when panel is open.

5. **Normalization**  
   `normalizeTheme(theme)` in ThemePalette clamps dots (0–1), limits dots to 3, customColors to 4, opacity 0.35–0.9, and validates accentColor hex.

---

## Token Generation (theme-generator.ts)

- **Input:** `CustomTheme`, `ThemeId`.  
- **Output:** CSS custom properties set on `document.documentElement` (see `THEME_TOKEN_KEYS`).
- **Resolve scheme:** `system` → `window.matchMedia('(prefers-color-scheme: dark)')`.
- **Palette:** From `customTheme.dots` (polar → HSL → RGB) or `customTheme.customColors` if non-empty.
- **Harmony:** `calculateCompliments(dots, action, harmony)` computes complementary dots from primary dot + harmony angles.
- **Constants:** `OPACITY_MIN = 0.35`, `OPACITY_MAX = 0.9`, `CUSTOM_COLOR_LIMIT = 4`.

Key exports: `generateThemeTokens`, `applyTheme` (via apply-theme.ts), `getDotColors`, `getColorFromPosition`, `clampDotPosition`, `resolveHarmonyForCount`.

---

## Presets (theme-presets.ts)

- **PRESET_PAGES:** Array of pages; each page is an array of `ThemePreset`.
- **ThemePreset:** `numDots` (1 | 3), `algo` (ThemeHarmony), `lightness`, `position`, optional `color`, `preview` (c1, c2, c3), `type`.
- One page is grayscale: `explicit-black-white` dots along x.

---

## Apply Theme (apply-theme.ts)

```ts
function applyTheme(theme: ThemeId, customTheme: CustomTheme): void
```

- Sets `data-theme` on `document.documentElement`.
- If `!customTheme?.enabled`, removes all `THEME_TOKEN_KEYS` and returns.
- Otherwise runs `generateThemeTokens(customTheme, theme)` and sets each key on `root.style`.

---

## UI Flow (ThemePanel)

1. `themePickerOpen` from store; when true, mount panel (with optional 180ms closing transition).
2. Sync `draftTheme` from `settings?.customTheme` when panel opens.
3. User changes: ThemePalette calls `onPreview` (live) and/or `onCommit` (store + save).
4. Scheme change: `handleSchemeChange` updates `settings.theme`, applies theme, schedules save.
5. Close: `handleClose` commits last preview if any, then `setThemePickerOpen(false)`.

---

## AI Agent Notes

- To change token set: edit `THEME_TOKEN_KEYS` and the return object in `generateThemeTokens`.
- New harmony: add to `ThemeHarmony` and `HARMONY_ORDER` in theme-generator (angles for 2nd/3rd dots).
- Preset UX: `PRESET_PAGES` and `ThemePreset`; ThemePalette uses `pageIndex` and preset click applies preset to draft and preview/commit.
