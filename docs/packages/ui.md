# Packages: UI

**Scope:** `packages/ui/`  
**Purpose:** Shared React components, Tailwind preset, design tokens for marketing and account apps.

---

## File Map

| Role | Path |
|------|------|
| Component exports | `packages/ui/src/index.ts` |
| Components | `packages/ui/src/components/*.tsx` (Button, Card, Badge, TrailLoader, ThemeToggle, WaitlistDialog, etc.) |
| Tailwind preset | `packages/ui/src/tailwind-preset.ts` (or tailwind-preset.ts) |
| Styles | `packages/ui/styles/*.css` (animations, base, tokens, trail-logo) |
| Utils | `packages/ui/src/utils/cn.ts` (classnames) |
| Types | `packages/ui/src/types/hero-patterns.d.ts` |

---

## Components (representative)

- **Button** — primary/secondary/ghost; size variants.  
- **Card** — container with optional padding/shadow.  
- **Badge** — small label.  
- **EmptyState** — icon + message for empty lists.  
- **InfoBanner** — inline message.  
- **PageHeader** / **SectionHeader** — headings.  
- **StatCard** — metric display.  
- **StepList** — numbered steps.  
- **ThemeToggle** — light/dark toggle.  
- **TrailLoader** — loading spinner/state.  
- **TrailLogo** — brand logo.  
- **WaitlistDialog** — modal for waitlist signup.  
- **BackgroundArt** — decorative background.

---

## Design Patterns

1. **Tailwind**  
   Preset extends Tailwind config with theme tokens (colors, font, spacing); apps extend this preset.

2. **cn()**  
   `cn(...classes)` merges class names (e.g. tailwind-merge); use for conditional styling.

3. **Tokens**  
   CSS vars or Tailwind theme for colors (ink, surface, stroke, elev), typography (trail-eyebrow, trail-title), shadows (elev-1, elev-2).

---

## AI Agent Notes

- New component: add to packages/ui/src/components, export from index; use in marketing or account.  
- Preset: change tokens in tailwind-preset and/or styles/tokens.css; ensure marketing and account both use @trail/ui preset.  
- Do not edit generated files; component source is the source of truth.
