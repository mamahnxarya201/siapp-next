# Bill of Manifest

## Runtime dependencies

None. The experimental Gantt runtime uses only browser platform APIs and local ES
modules. It does not import React, Preact, Vue, Svelte, morphdom, jQuery, Zustand,
Tailwind, Radix, date-fns, or any other runtime package.

This is deliberate: the required features are narrow: named command dispatch, explicit
view invalidation, scheduled work, strict transport envelopes, DOM task rows, and SVG
timeline rendering. A general UI framework would add lifecycle and abstraction surface
that this migration does not need.

## Vendored icon asset set: Lucide

- Source: `lucide-react` 0.564.0 already present in the parent PMIS project.
- License: ISC.
- Used icons: `Blocks`, `ServerCog`, `PanelsTopLeft`, `ShieldCheck`, `Rocket`,
  `ChevronDown`, `ChevronRight`, `Plus`, `MoreHorizontal`, `GitBranch`,
  `ListTodo`, `CircleAlert`, `Activity`, `CheckCircle2`, `Menu`, `Moon`,
  `Bell`, `Settings2`, and chart geometry.
- Location: the small namespace-aware SVG path map in `src/renderer.js`
  (`sidebarIconPaths`).
- Reason: the experiment is a browser-native vanilla module and cannot import
  the React component package without pulling React and a bundler into the
  isolated runtime. The selected Lucide path data is vendored as SVG geometry
  so the sidebar matches the React icon proportions and stroke treatment.
- Runtime impact: no package download, bundle, or module-resolution change;
  icons are created with `document.createElementNS` during sidebar rendering.
- Replacement strategy: if the experiment later gains a bundler, replace the
  local path map with official Lucide imports and keep the same icon names and
  14px/1.8px stroke contract.

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

## Demo entry points

- `demo/index.html` + `demo/demo.js`: React-aligned 240-task `p3` fixture used
  for the populated timeline demo and browser scenarios.
- `demo/empty.html` + `demo/empty.js`: the same shell, controls, tokens, and
  engine boundary initialized with empty task and workstream arrays. It is a
  separate entry point so empty-state work can be tested without changing the
  populated demo fixture.

## Third-party code inspiration

Apart from the explicitly listed Lucide icon paths, no third-party source code was
copied into the mini-framework. The implementation uses ordinary platform patterns:
root event delegation, a map-backed command registry, dirty-view scheduling, strict
ports/adapters, and namespace-aware SVG creation.

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
