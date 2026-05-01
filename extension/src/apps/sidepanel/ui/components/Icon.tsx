/**
 * Legacy path — the icon registry now lives at `@ui/components/icons`.
 * Re-exported here so sidepanel code that imports `./Icon.js` keeps
 * working. New code should import from `@ui/components/icons` directly.
 */
export { Icons, type IconName, type IconProps } from "@ui/components/icons";
