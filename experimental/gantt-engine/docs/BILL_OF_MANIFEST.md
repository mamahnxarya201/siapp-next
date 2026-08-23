# Bill of manifest

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

### Why it is used

- synthetic DOM tests cannot prove pointer drag, SVG visibility, native scrolling,
  sticky headers, label/control behavior, or real browser event propagation;
- Playwright provides stable locators, pointer input, polling, traces, screenshots, and
  deterministic test isolation;
- it is already accepted by the repository and used by the React PMIS tests.

### Advantages

- real installed Chrome execution;
- accessible-role and locator assertions;
- failure traces/screenshots in the OS temporary directory;
- one worker avoids shared demo-state races;
- no new production bundle code.

### Disadvantages

- browser startup is slower than Node tests;
- the test environment needs an installed supported Chrome;
- Windows child-process cleanup requires the local `tests/run-e2e.mjs` wrapper;
- browser tests require explicit deterministic fixtures.

## Development dependency: `katex`

- Declared version: `^0.18.4` in `package.json`.
- License: MIT.
- Purpose: build-time rendering of KaTeX-compatible Markdown equations in the
  offline documentation portal.

### Why it is used

- the Markdown contracts contain inline and display equations for connector
  geometry, snapping, and forecast calculations;
- the previous generator emitted `$...$` and `$$...$$` as literal text;
- KaTeX produces static HTML and accessible MathML without browser-side
  JavaScript.

### Runtime and portal impact

- KaTeX is not imported by the Gantt runtime;
- `npm run docs:build` renders equations and inlines the KaTeX stylesheet and
  font files as data URLs;
- `docs/index.html` remains usable through `file://` without a server or network
  request;
- embedded fonts increase the generated HTML size.

### Replacement strategy

If the documentation portal moves to a generator with native KaTeX support,
remove the custom equation parsing and direct `katex` dependency. Keep the
KaTeX-compatible Markdown source unchanged.

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

Both demos keep schedule commits in a module-scoped `storedTasks` array behind
`InMemoryTransport`. This storage survives engine renders and timeline
compaction, but it does not survive a full browser or Vite module reload. Reloading
the page recreates the module and restores the entry point's initial fixture:
240 tasks for `demo/index.html` and no tasks for `demo/empty.html`.

This reload boundary is separate from compaction. If a reported task loss also
changes the `document` or navigation entry, investigate the reload trigger before
changing range logic. Persistent schedule storage requires a future host or
gateway implementation.

## UI primitive storyboard

- `demo/ui-primitives-storyboard.html` compares the existing React button/input
  semantics with `pmis-button` and `pmis-textfield` custom elements.
- `demo/index.html` and `demo/empty.html` load the primitives; the logo dialog's
  Save and Cancel actions use `pmis-button`.
- `src/ui-primitives.js` uses only Custom Elements, Shadow DOM, slots, and native
  button/input controls. No runtime or development dependency was added.

### Adoption rule for future experimental UI

- New experimental buttons MUST use `pmis-button`; new single-line text inputs
  SHOULD use `pmis-textfield`.
- Load `src/ui-primitives.js` from the host entry module. Configure appearance
  with `variant` and `size` attributes.
- Do not paint `background`, `color`, hover, or border-radius on the custom
  element host. The visible native control is inside Shadow DOM; host-level
  paint creates square-corner artifacts or diverges from the shared primitive.
- Preserve `data-action` names and accessibility labels when migrating existing
  controls. Update `ActionDelegator` and focus traps when adding a new custom
  interactive tag.

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

## Project logo and name header — no new dependency

The top-navigation project image/name feature in `demo/index.html` and
`demo/empty.html` adds no runtime or development package.

Capability requested:
- inline project rename from the header name control;
- a project-logo picker popup that uploads an image, applies it to a fixed-aspect
  (square) crop, and positions/zooms the source image before saving.

Why no third-party package:
- the crop interaction is narrow and already exists as a custom implementation in the
  React PMIS `components/pmis/top-nav.tsx`, which uses `FileReader`, Pointer Events,
  and a CSS `translate/scale` transform against a locked square crop frame. No external
  crop library is used there either.
- per `STD-COC.md`, "Not Invented Here" takes precedence; a library would add
  dependency surface for three small techniques: data-URL file reading, pointer drag,
  and wheel zoom.
- the project has no image-processing requirement (no resize, EXIF rotation, or
  server upload). The selected image is displayed with `object-fit: cover` inside the
  32px header logo box, mirroring the React behavior.

Implementation:
- file selection: native `FileReader.readAsDataURL`;
- crop positioning: Pointer Events with `setPointerCapture` on the crop surface;
- zoom: the `wheel` event clamped to a 0.5–3 scale range;
- fixed aspect ratio: a 144px square crop frame (`aspect-square`) centered over a
  224px crop surface, matching the React `h-36`/`aspect-square` overlay;
- keyboard: Tab traps inside the dialog (Choose image → Save logo → Cancel → loop),
  Escape cancels, focus returns to the logo button on close;
- persistence: none. The demo keeps both the renamed project name and the logo
  in engine memory for the current session, per user decision on 2026-08-18.

Removal/replacement strategy:
- if a future host requires persisted or server-side project media, replace the
  in-memory `state.logo`/`state.projectName` with a gateway operation and keep the
  same command names and dialog markup.

Vendored icon:
- the "Choose image" upload glyph is the Lucide `upload` path (three `<path>` strokes),
  vendored as inline SVG geometry under the same ISC Lucide 0.564.0 treatment already
  documented in the vendored icon asset set above.
