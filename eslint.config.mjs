import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import playwright from "eslint-plugin-playwright";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // e2e: Playwright's recommended rules (no waitForTimeout/force/test.only,
  // awaited web-first assertions) keep the suite from going flaky.
  {
    ...playwright.configs["flat/recommended"],
    files: ["e2e/**"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // Assertions live in page objects and fixtures as well as specs.
      "playwright/expect-expect": ["warn", { assertFunctionNames: ["expect*"] }],
      // Playwright fixtures call `use()` — not React's hook.
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // Page objects and DB helpers may branch on page state; specs may not.
    files: ["e2e/pages/**", "e2e/support/**", "e2e/fixtures.ts"],
    rules: { "playwright/no-conditional-in-test": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
