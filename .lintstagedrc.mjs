// Monorepo lint-staged config.
// lint-staged passes absolute file paths; we route them to the right
// package's tools. Each function returns the shell command to run.

import { relative } from "node:path";

const EXT_ROOT = new URL("./extension/", import.meta.url).pathname;

/** Strip the `extension/` prefix so eslint/prettier see paths relative to the package. */
function stripExtension(files) {
  return files.map((f) => relative(EXT_ROOT, f)).map((f) => `"${f}"`).join(" ");
}

/** Route prettier through a workspace that has it installed. Marketing pulls
 *  prettier in its devDependencies, so `pnpm --filter @trail/marketing exec`
 *  resolves the binary. Paths are passed absolute because pnpm changes cwd
 *  to the filtered package, and quoting avoids brackets in `[locale]`
 *  segments being interpreted as shell globs. */
function prettierFromWorkspace(files) {
  const paths = files.map((f) => `"${f}"`).join(" ");
  return `pnpm --filter @trail/marketing exec prettier --write ${paths}`;
}

export default {
  "extension/src/**/*.{ts,tsx}": (files) => {
    const args = stripExtension(files);
    return [
      `bash -c 'cd extension && pnpm eslint --fix ${args}'`,
      `bash -c 'cd extension && pnpm prettier --write ${args}'`,
    ];
  },
  "extension/src/**/*.{css,json}": (files) => {
    const args = stripExtension(files);
    return [`bash -c 'cd extension && pnpm prettier --write ${args}'`];
  },
  "apps/**/*.{ts,tsx,js,jsx,css,json}": prettierFromWorkspace,
  "packages/**/*.{ts,tsx,js,jsx,css,json}": prettierFromWorkspace,
};
