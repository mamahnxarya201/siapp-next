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

On 2026-08-15 the combined command completed cleanly with:

- 45 Node tests passed;
- 8 Chrome/Playwright scenarios passed;
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
2. dependency preview and commit through the scoped context menu;
3. delegated scale and dependency controls, hover disclosure, selected chains, and
   calculated critical bar emphasis;
4. workstream collapse removing matching task rows, bars, and connector endpoints;
5. real pointer drag commit with recursive dependent propagation and unrelated-task
   preservation;
6. predecessor-left movement leaving a child unchanged;
7. two-way vertical scroll synchronization, right-edge range growth, idle compaction,
   and milestone rendering;
8. scheduled `schedule.reload` through the injected gateway.

## Process lifecycle

`tests/run-e2e.mjs` starts `static-server.mjs` directly and owns its child PID. It waits
for HTTP readiness, starts Playwright, captures the Playwright exit code, and terminates
the server in `finally`. Open server sockets are destroyed on termination. This wrapper
exists because Playwright's Windows `webServer` helper left the child alive after green
tests in this repository.

Test artifacts use the OS temporary directory through `playwright.config.mjs`; they do
not dirty the repository. Chrome is selected through `channel: 'chrome'`, reusing the
installed browser rather than downloading a Playwright-managed runtime.

## PHP integration tests for the next agent

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
