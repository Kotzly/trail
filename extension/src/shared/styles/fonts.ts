/**
 * Eager-bundled fontsource imports — the top-5 fonts used by the most theme
 * presets, plus Geist as the Default-theme baseline. The remaining ~19 fonts
 * referenced by other presets are lazy-loaded on demand from `font-loaders.ts`
 * when the user picks a preset that needs them.
 *
 * Why JS imports (not CSS @import): Tailwind v4 + Vite (WXT) leaves CSS
 * `@import "@fontsource-variable/X"` URLs unrewritten, so woff2 files never
 * reach the build. JS imports route fontsource CSS through Vite's asset
 * pipeline so URLs resolve and files are bundled.
 */

import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/fira-code";
