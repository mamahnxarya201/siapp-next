# Bill of Manifest

## Runtime dependencies

None. The experimental Gantt runtime uses only browser platform APIs and local ES
modules. It does not import React, Preact, Vue, Svelte, morphdom, jQuery, Zustand,
Tailwind, Radix, date-fns, or any other runtime package.

This is deliberate: the required features are narrow: named command dispatch, explicit
view invalidation, scheduled work, strict transport envelopes, DOM task rows, and SVG
timeline rendering. A general UI framework would add lifecycle and abstraction surface
that this migration does not need.

## Development dependency: `@playwright/test`

- Declared version: `^1.62.1` in the experimental `package.json`.
- Resolved from the repository's existing parent installation.
- Purpose: browser-level interaction and layout verification.

Why it is used:

- synthetic DOM tests cannot prove pointer drag, SVG visibility, native scrolling,
  sticky headers, label/control behavior, or real browser event propagation;
- Playwright provides stable locators, pointer input, polling, traces, screenshots, and
  deterministic test isolation;
- it is already accepted by the repository and used by the React PMIS tests.

Advantages:

- real installed Chrome execution;
- accessible-role and locator assertions;
- failure traces/screenshots in the OS temporary directory;
- one worker avoids shared demo-state races;
- no new production bundle code.

Disadvantages:

- browser startup is slower than Node tests;
- the test environment needs an installed supported Chrome;
- Windows child-process cleanup requires the local `tests/run-e2e.mjs` wrapper;
- browser tests require explicit deterministic fixtures.

## Built-in development facilities

The following are not third-party manifest entries:

- `node:test` and `node:assert/strict` for unit/integration tests;
- `node:http` for the local static test server;
- `node:child_process` for deterministic server/runner ownership;
- native `fetch`, `AbortController`, `queueMicrotask`, timers, and ES modules;
- browser DOM, SVG, Pointer Events, `ResizeObserver`-compatible layout, and
  `requestAnimationFrame`.

## Third-party code inspiration

No third-party source code was copied into the mini-framework. The implementation uses
ordinary platform patterns: root event delegation, a map-backed command registry,
dirty-view scheduling, strict ports/adapters, and namespace-aware SVG creation.

## Approval rule for future dependencies

Before adding any runtime or development package, update this file with:

1. the missing capability;
2. why a local implementation is unsafe or materially more expensive;
3. package/version and license;
4. runtime/bundle/process impact;
5. advantages and disadvantages;
6. removal or replacement strategy;
7. user approval when the dependency expands the accepted architecture.

Reading a library for one small technique does not authorize importing it. Reimplement
only the narrow behavior needed and document provenance if source, not merely the public
idea, is adapted.
