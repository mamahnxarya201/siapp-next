import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "tsconfig.tsbuildinfo",
  ]),
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
])
