type BooleanFlagDef = {
  type: 'boolean';
  default: boolean;
  label: string;
  description: string;
};

type VariantFlagDef<V extends string = string> = {
  type: 'variant';
  default: V;
  variants: readonly V[];
  label: string;
  description: string;
};

export type FlagDef = BooleanFlagDef | VariantFlagDef;

export const FLAG_DEFS = {
  fullView: {
    type: 'boolean',
    default: false,
    label: 'Full View',
    description: 'Show the "Open full view" button in the graph toolbar.',
  },
} as const satisfies Record<string, FlagDef>;

export type FlagKey = keyof typeof FLAG_DEFS;

export type FlagValue<K extends FlagKey> =
  (typeof FLAG_DEFS)[K] extends { type: 'boolean' }
    ? boolean
    : (typeof FLAG_DEFS)[K] extends { type: 'variant'; variants: readonly (infer V)[] }
      ? V
      : never;

export type ResolvedFlags = { [K in FlagKey]: FlagValue<K> };

export type PersistedFlagState = {
  v: 1;
  overrides: Partial<Record<string, unknown>>;
};

const FLAG_KEYS = Object.keys(FLAG_DEFS) as FlagKey[];

function resolveSingleFlag(def: FlagDef, override: unknown): unknown {
  if (override === undefined || typeof override !== typeof def.default) {
    return def.default;
  }
  if (def.type === 'variant') {
    return (def.variants as readonly string[]).includes(override as string)
      ? override
      : def.default;
  }
  return override;
}

export function resolveFlags(overrides: Partial<Record<string, unknown>>): ResolvedFlags {
  const result = {} as Record<string, unknown>;
  for (const key of FLAG_KEYS) {
    result[key] = resolveSingleFlag(FLAG_DEFS[key], overrides[key]);
  }
  return result as ResolvedFlags;
}
