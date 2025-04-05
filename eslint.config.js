import eslint from "@eslint/js";
import reactRefresh from "eslint-plugin-react-refresh";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config} */
export default [
  // Base configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Global settings for all files
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        performance: "readonly",
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
        pragma: "h", // For Preact
        jsxRuntime: "automatic",
      },
      jsxImportSource: "preact",
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Core rules that are actually helpful
      "no-console": ["warn", { allow: ["info", "warn", "error", "debug"] }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-debugger": "warn",
      "no-duplicate-case": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-inner-declarations": "off",

      // Make unused vars a warning instead of error, and allow underscore prefix

      // React rules
      "react/jsx-no-target-blank": "off",
      "react/prop-types": "off",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // TypeScript specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        jsxPragma: "h",
        jsxFragmentPragma: "Fragment",
      },
    },
    rules: {
      // Override TypeScript rules to be more sensible

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-ignore": "allow-with-description",
          minimumDescriptionLength: 5,
        },
      ],
    },
  },

  // JSX/TSX specifics
  {
    files: ["**/*.jsx", "**/*.tsx"],
    rules: {
      "react/jsx-uses-vars": "error",
      "react/no-unknown-property": ["error", { ignore: ["class"] }],
    },
  },

  // Config files with specific project reference
  {
    files: ["vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.node.json",
      },
    },
  },

  // Ignores
  {
    ignores: ["node_modules/**", "dist/**"],
  },
];
