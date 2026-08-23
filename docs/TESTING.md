# Testing and verification manual

## Commands

Run from `experimental/gantt-engine`:

```powershell
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd test
```

`npm.cmd test` is the completion gate. It runs all Node tests followed by all browser
tests and must exit with code 0. A passing assertion count followed by a hanging process
is a failure.

## Current verified baseline

On 2026-08-23 the completion gate finished cleanly with:

- 60 Node tests passed;
- 43 Chrome/Playwright scenarios passed;
- no failed, skipped, cancelled, or unresolved tests;
- the static server terminated normally after Playwright.

## Test layers

### Framework tests

`tests/framework.test.mjs` uses Node's built-in test runner and lightweight fake roots.
It verifies:

- command registration, execution, unregistration, duplicate protection, and disposal;
- one delegated root listener per click/submit/change event;
- ignored disabled controls and surfaced unknown commands;
- cancellable microtask, animation-frame, delayed, and async jobs;
- `AbortSignal` propagation;
- coalesced invalidation and explicit refresh;
- no automatic retry loop after render failure;
- application start/stop/dispose and startup rollback.

### Gantt kernel tests

`tests/gantt-kernel.test.mjs` verifies:

- both PMIS input shapes and canonical derived dependents;
- duplicate/cycle/dangling/self dependency rejection;
- accepted geometry constants and scale widths;
- visible weekday compression, half-day boundaries, and snapping;
- workstream/graph independence and deterministic row positions;
- none/hover/selection/all/critical dependency disclosure;
- normal and cramped continuous connector routes;
- direct dependent clamping and multiple-predecessor latest-end behavior;
- recursive forward-only propagation, duration preservation, no backward pull, and
  unrelated-task immutability;
- PERT expected duration and CPM earliest/latest/slack/critical calculations;
- empty and malformed forecast inputs.

### Bridge tests

`tests/php-bridge.test.mjs` verifies the future PHP boundary without a PHP server:

- application-facing exports exclude concrete transports;
- view/renderer modules do not import transports or PHP details;
- normalized `{ok,data,error,meta}` results;
- handler failures and unknown operations;
- strict JSON-safe serialization;
- idempotent replay and conflicting key detection;
- deadlines, cancellation, and already-aborted signals;
- fetch wire envelope, auth headers, operation version, and idempotency headers;
- normalized PHP errors, connection failures, malformed responses, content type, and
  unserializable error detail handling.

### Browser tests

`tests/e2e/gantt.spec.mjs` opens the static demo in installed Chrome and verifies:

1. task creation, scoped context-menu bar creation, and dark/light/editorial theme
   switching;
2. frame-bounded dependency preview, commit through the scoped context menu,
   stable preview-node identity, and connected cramped-route endpoints;
3. delegated scale and dependency controls, hover disclosure, selected chains, and
   calculated critical bar emphasis;
4. adaptive Tom-style connector geometry, a 12px invisible hover corridor,
   hover-only segment cues, and at most three cues per route;
5. half-day movement and both resize edges, one-day task creation, enlarged
   non-overlapping resize targets at week and month scales, and connector hover
   behavior beside selected bars;
6. workstream collapse removing matching rows, bars, and connector endpoints;
7. real pointer drag commit with recursive dependent propagation, active-preview
   connector continuity, edge-constrained incoming and outgoing attachments, and
   unrelated-task preservation;
8. predecessor-left movement leaving a child unchanged;
9. uninterrupted following-edge, preceding-edge, reversal, and resize-edge
   autoscroll;
10. viewport-sized preceding-range buffering without per-date origin
    re-anchoring;
11. interior release retaining an expanded arena, **Compact timeline** removing
    excess capacity, and repeated activation preserving an already compact
    viewport;
12. edge-release compaction preserving task identity, duration, DOM presence,
    visibility, and the viewport-sized minimum range;
13. rapid diagonal swipes after compaction preserving task identity, duration,
    scrollable geometry, and range containment;
14. context-created cross-month drag preserving the document, URL, history,
    navigation count, task ID, one-day duration, committed date, and bar
    geometry;
15. custom scrollbar track jumps and grab-offset-preserving thumb drags;
16. one shared vertical scroll region, sticky task and calendar headers, stable
    date range during center drags, a 20px post-task viewport minimum,
    horizontal timeline scrolling, following-edge range growth, idle
    compaction, and milestone rendering;
17. scheduled `schedule.reload` through the injected gateway.

## Process lifecycle

`tests/run-e2e.mjs` starts `static-server.mjs` directly and owns its child PID. It waits
for HTTP readiness, starts Playwright, captures the Playwright exit code, and terminates
the server in `finally`. Open server sockets are destroyed on termination. This wrapper
exists because Playwright's Windows `webServer` helper left the child alive after green
tests in this repository.

Test artifacts use the OS temporary directory through `playwright.config.mjs`; they do
not dirty the repository. Chrome is selected through `channel: 'chrome'`, reusing the
installed browser rather than downloading a Playwright-managed runtime.

## PHP integration tests

When a PHP endpoint is added, retain all current tests and add an integration suite that
starts the PHP test server on a separate port, injects `FetchTransport`, and checks the
exact contract in `PHP_BRIDGE_CONTRACT.md`. Minimum cases:

- valid load and commit;
- authentication rejection;
- validation error with stable code;
- idempotent replay and conflicting reuse;
- operation-version mismatch;
- timeout and client cancellation;
- non-JSON response and mismatched request ID;
- concurrent requests resolving out of order without stale state overwrite.

Do not make Playwright depend on production PHP data. Use deterministic integration
fixtures and a disposable test database or in-memory PHP repository.

## Manual visual audit

Automated tests prove behavior but not every visual detail. A human audit should check:

- task-list rows and timeline bars remain aligned during deep scrolling;
- long connectors are continuous to the arrowhead;
- cramped connectors approach from above without backward arrows;
- selected resize handles remain usable at all scales;
- day/week/month labels remain legible;
- critical and normal dependency colors are distinct;
- no right inspector, dashboard, or application navigation leaked into the experiment.

## Completion rule

Do not claim verification if any required command fails, hangs, requires manual
termination, leaves a listening test server, skips a scenario, or only passes a narrower
subset than the changed behavior.
