import type { SpotlightSuggestionGroup } from '@shared/rpc/contracts.js';

export type SpotlightField = 'domain' | 'tab' | 'tree' | 'group' | 'is';

export type SpotlightToken = {
  raw: string;
  value: string;
  negated: boolean;
  exact: boolean;
  field?: SpotlightField;
};

export type SpotlightQueryClause = {
  terms: SpotlightToken[];
};

export type SpotlightQueryAst = {
  clauses: SpotlightQueryClause[];
};

export type SpotlightQueryMode = 'discover' | 'search' | 'commands';

const VALID_FIELDS: ReadonlySet<SpotlightField> = new Set([
  'domain',
  'tab',
  'tree',
  'group',
  'is',
]);

const VALID_TAB_VALUES = new Set(['open', 'closed']);
const VALID_TREE_VALUES = new Set(['current', 'other', 'any']);
const VALID_GROUP_VALUES = new Set<SpotlightSuggestionGroup>([
  'open-tabs',
  'recently-closed',
  'current-tree',
  'other-trees',
]);
const VALID_IS_VALUES = new Set(['current']);

export function tokenizeSpotlightQuery(input: string): SpotlightToken[] {
  const chunks = splitRawTokens(input);
  const out: SpotlightToken[] = [];

  for (const chunk of chunks) {
    if (chunk === '|') {
      out.push({
        raw: '|',
        value: '|',
        negated: false,
        exact: false,
      });
      continue;
    }

    let token = chunk;
    let exact = false;

    if (token.length >= 2 && token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
      exact = true;
    }

    let negated = false;
    if (token.startsWith('-') && token.length > 1) {
      negated = true;
      token = token.slice(1);
    }

    if (!token) continue;

    const base: SpotlightToken = {
      raw: chunk,
      value: token,
      negated,
      exact,
    };

    if (!exact) {
      const maybeField = parseFieldToken(token);
      if (maybeField) {
        out.push({
          ...base,
          value: maybeField.value,
          field: maybeField.field,
        });
        continue;
      }
    }

    out.push(base);
  }

  return out;
}

export function parseSpotlightQuery(input: string): SpotlightQueryAst {
  const tokens = tokenizeSpotlightQuery(input);

  const clauses: SpotlightQueryClause[] = [];
  let current: SpotlightQueryClause = { terms: [] };

  for (const token of tokens) {
    if (token.raw === '|') {
      if (current.terms.length > 0) {
        clauses.push(current);
      }
      current = { terms: [] };
      continue;
    }
    current.terms.push(token);
  }

  if (current.terms.length > 0) {
    clauses.push(current);
  }

  return {
    clauses: clauses.length > 0 ? clauses : [{ terms: [] }],
  };
}

export function resolveSpotlightQueryMode(input: string): { mode: SpotlightQueryMode; normalizedQuery: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { mode: 'discover', normalizedQuery: '' };
  }
  if (trimmed.startsWith('>')) {
    return { mode: 'commands', normalizedQuery: trimmed.slice(1).trim() };
  }
  return { mode: 'search', normalizedQuery: trimmed };
}

function splitRawTokens(input: string): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (!ch) break;

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '|') {
      out.push('|');
      i += 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < input.length && input[j] !== '"') {
        j += 1;
      }
      if (j < input.length) {
        out.push(input.slice(i, j + 1));
        i = j + 1;
      } else {
        // Unclosed quote: degrade to plain token without throwing.
        let k = i;
        while (k < input.length && !/\s/.test(input[k] ?? '')) {
          k += 1;
        }
        out.push(input.slice(i, k));
        i = k;
      }
      continue;
    }

    let j = i;
    while (j < input.length) {
      const cur = input[j];
      if (!cur || /\s/.test(cur) || cur === '|') break;
      j += 1;
    }
    out.push(input.slice(i, j));
    i = j;
  }

  return out;
}

function parseFieldToken(token: string): { field: SpotlightField; value: string } | null {
  const colon = token.indexOf(':');
  if (colon <= 0 || colon === token.length - 1) {
    return null;
  }

  const fieldRaw = token.slice(0, colon).toLowerCase();
  const valueRaw = token.slice(colon + 1).toLowerCase();
  if (!valueRaw) return null;

  if (!VALID_FIELDS.has(fieldRaw as SpotlightField)) {
    return null;
  }

  const field = fieldRaw as SpotlightField;

  if (field === 'tab' && !VALID_TAB_VALUES.has(valueRaw)) {
    return null;
  }
  if (field === 'tree' && !VALID_TREE_VALUES.has(valueRaw)) {
    return null;
  }
  if (field === 'group' && !VALID_GROUP_VALUES.has(valueRaw as SpotlightSuggestionGroup)) {
    return null;
  }
  if (field === 'is' && !VALID_IS_VALUES.has(valueRaw)) {
    return null;
  }

  return { field, value: valueRaw };
}
