# PMIS static-analysis baseline

## Problem

`pnpm lint` previously stopped before checking the repository because ESLint 10
requires a flat `eslint.config.*` file. The project did not provide one. The
application is predominantly TypeScript and TSX, but the repository currently
does not include a TypeScript-aware ESLint parser or the Next.js ESLint preset.

## Implementation

- `eslint.config.mjs` opts into ESLint's flat configuration and excludes generated
  Next.js, dependency, and TypeScript incremental-build output.
- ESLint checks the repository's JavaScript configuration files for a small,
  dependency-free correctness baseline.
- The lint script then runs TypeScript with `--noEmit --incremental false`, so all
  TypeScript and TSX application code is parsed and type-checked without writing
  build artifacts.
This is intentionally a minimal repair rather than a silent substitution for the
Next.js recommended lint rules. Adding `eslint-config-next` and a TypeScript-aware
ESLint parser remains a future toolchain enhancement when those dependencies are
available. The current command is nevertheless meaningful: JavaScript is linted,
and every TypeScript/React source file is validated by the TypeScript compiler.

## Verification

Run the repository-wide check with:

```sh
pnpm lint
```

The production compilation remains a separate check:

```sh
pnpm build
```
