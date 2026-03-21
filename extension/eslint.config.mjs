import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import("typescript-eslint").ConfigArray} */
export default [
  // ── Global ignores ──────────────────────────────────────────────
  {
    ignores: [
      ".wxt/",
      ".output/",
      "dist/",
      "node_modules/",
      "*.cjs",
      "scripts/",
      "src/shared/vendor/",
    ],
  },

  // ── TypeScript base ─────────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ── All TS/TSX files ────────────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      // ── TypeScript ────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ── React hooks (applies to .ts too — hooks live in .ts files) ──
      ...reactHooks.configs.recommended.rules,
      // Downgrade new react-hooks v7 rules to warnings — fix incrementally
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",

      // ── General ───────────────────────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],
      "no-debugger": "warn",
      "no-duplicate-imports": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  // ── React component files ──────────────────────────────────────
  {
    files: ["src/**/*.tsx"],
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral",
          message:
            "Use cn() instead of template literals for className — formatters can strip spaces and silently break class composition.",
        },
      ],
    },
  },

  // ── Test files (relaxed) ────────────────────────────────────────
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // ── Disable formatting rules (Prettier handles it) ─────────────
  eslintConfigPrettier,
];
