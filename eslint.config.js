import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "hylo-vscode/**",
      "vendor/**",
      "public/**",
      "**/*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        Worker: "readonly",
        Blob: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        fetch: "readonly",
        HTMLElement: "readonly",
        MessageEvent: "readonly",
        KeyboardEvent: "readonly",
        ErrorEvent: "readonly",
        MediaQueryListEvent: "readonly",
        Response: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        ResizeObserver: "readonly",
        __TAURI_INTERNALS__: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-undef": "off",
    },
  },
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
);
