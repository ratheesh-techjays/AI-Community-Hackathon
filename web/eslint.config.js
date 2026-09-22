import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "src/api/generated/**", "node_modules"] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,

  // Config files live outside tsconfig's include, so type-aware rules cannot
  // run on them. Without this they crash the whole lint run.
  {
    files: ["*.config.js", "*.config.ts", "eslint.config.js", "vite.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    // Typed rules only where tsconfig reaches. Config files are handled above.
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: ["./tsconfig.json"], tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ---- F2: no hardcoded design values ------------------------------
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,8})$/]",
          message:
            "Raw colour literal. Use a semantic token from design/tokens/contract.css.ts. " +
            "Raw literals belong only in design/tokens/primitive.ts.",
        },
        {
          selector: "Literal[value=/^-?\\d+(\\.\\d+)?(px|em|ms)$/]",
          message:
            "Raw dimension literal. Use vars.space / vars.radius / vars.font / vars.duration.",
        },
        {
          // Inline CSS is banned. The ONE sanctioned exception is
          // assignInlineVars(), which emits only CSS custom properties and is
          // how a runtime value (a timeline position) reaches CSS. It is
          // matched below and allowed.
          selector:
            "JSXAttribute[name.name='style'] > JSXExpressionContainer > :not(CallExpression[callee.name='assignInlineVars'])",
          message:
            "Inline CSS is banned. Use a .css.ts file, or assignInlineVars() for a genuinely dynamic value.",
        },
      ],

      // ---- F3: one transport layer -------------------------------------
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use apiClient from @/api/client." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "fetch",
          message: "Use apiClient from @/api/client.",
        },
      ],

      // ---- general -----------------------------------------------------
      "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Counts and metrics are interpolated into captions constantly.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },

  // The design-system transcription is the ONE place raw literals are allowed.
  {
    files: ["src/design/tokens/source.ts"],
    rules: { "no-restricted-syntax": "off" },
  },

  // Tests assert literal token values on purpose -- that is the point of the
  // design-system guard tests.
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },

  // The transport layer is the ONE place fetch is allowed.
  {
    files: ["src/api/client.ts"],
    rules: { "no-restricted-globals": "off" },
  },

  // .css.ts files legitimately carry layout lengths the token scale does not
  // cover (a 34px track height, a 14px marker). Colour literals stay banned.
  {
    files: ["src/**/*.css.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,8})$/]",
          message: "Raw colour literal. Use a token from design/tokens/contract.css.ts.",
        },
      ],
    },
  },

  // deck.gl and MapLibre need imperative style objects for canvas rendering.
  // These must still read from resolved tokens, never literals.
  {
    files: ["src/map/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,8})$/]",
          message: "Use useResolvedTokens() to bridge tokens into deck.gl RGBA tuples.",
        },
      ],
    },
  },
);
