export const IS_MAC = /Mac|iPod|iPhone|iPad/.test(
  (globalThis.navigator as Navigator & { userAgentData?: { platform: string } })?.userAgentData
    ?.platform ??
    globalThis.navigator?.platform ??
    "",
);
