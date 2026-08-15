# Gantt engine JavaScript/PHP bridge contract

Status: experimental contract for task 006

Protocol version: `1.0`

Runtime dependencies: browser/Node built-ins only

## Purpose and boundary

The bridge gives application command handlers one stable way to call a named
operation, regardless of whether the operation is handled in memory or later
delivered to PHP over HTTP.

It has four responsibilities:

1. create and validate a transport-neutral request envelope;
2. serialize values into the shared JSON data model;
3. coordinate timeout and caller cancellation;
4. return every outcome as `{ ok, data, error, meta }`.

The bridge is not a renderer, state store, domain service, generated RPC system,
PHP client SDK, or automatic retry mechanism. This package contains no PHP server
and chooses no PHP framework, database, or authentication system.

## Non-negotiable import rule

Views, DOM renderers, SVG renderers, and interaction render loops MUST NOT import:

- `transports.mjs`;
- `fetch-transport.mjs` or `in-memory-transport.mjs`;
- endpoint URLs, HTTP headers, PHP route names, or PHP function names.

The permitted dependency direction is:

```text
button / delegated DOM event
  -> application command or controller
    -> Gateway.execute(operation, payload, options)

application composition root
  -> constructs InMemoryTransport or FetchTransport
  -> injects the transport into Gateway
  -> injects application commands into views/controllers
```

`src/bridge/index.mjs` exposes only the application-facing gateway, error
vocabulary, and protocol version. `src/bridge/transports.mjs` is a separate,
composition-root-only surface. The contract test scans view/renderer source for
transport imports, direct network APIs, endpoint paths, and PHP details.

An application command may depend on `Gateway`. A view should depend on an
application command such as `commitScheduleChange(command)`, not on a transport.
This preserves the intended event-oriented sequence: user event invokes command,
command awaits I/O, application state changes, renderer receives new state.

## Source map

| File | Responsibility |
| --- | --- |
| `src/bridge/index.mjs` | Application-facing exports. |
| `src/bridge/gateway.mjs` | Named operations, request creation, cancellation, normalization. |
| `src/bridge/protocol.mjs` | Version, validation, and exact envelope rules. |
| `src/bridge/serialization.mjs` | JSON-safe cloning, Date conversion, unsafe-value rejection. |
| `src/bridge/errors.mjs` | Shared error taxonomy and `BridgeError`. |
| `src/bridge/cancellation.mjs` | Caller/timeout cancellation and abort races. |
| `src/bridge/transports.mjs` | Composition-root-only transport exports. |
| `src/bridge/in-memory-transport.mjs` | Demo/test operation registry and replay. |
| `src/bridge/fetch-transport.mjs` | Future HTTP delivery using platform `fetch`. |
| `tests/php-bridge.test.mjs` | Executable `node:test` contract. |

## JavaScript Gateway API

Construct the selected transport and gateway once in the composition root:

```js
import { Gateway } from "./src/bridge/index.mjs";
import { InMemoryTransport } from "./src/bridge/transports.mjs";

const transport = new InMemoryTransport({
  handlers: {
    "schedule.commit": async (payload, context) => {
      context.signal.throwIfAborted();
      return scheduleService.commit(payload);
    },
  },
});

export const gateway = new Gateway({
  transport,
  defaultTimeoutMs: 15_000,
  clientName: "gantt-engine",
  clientVersion: "experimental",
});
```

Application command code invokes a named operation:

```js
const result = await gateway.execute(
  "schedule.commit",
  {
    projectId: "project-1",
    taskId: "task-7",
    startDate: new Date("2026-08-20T00:00:00.000Z"),
    endDate: new Date("2026-08-22T00:00:00.000Z"),
  },
  {
    operationVersion: 1,
    idempotencyKey: "drag-task-7-018f6f9a",
    timeoutMs: 10_000,
    signal: navigationAbortController.signal,
  },
);

if (!result.ok) {
  applicationNotifications.report(result.error);
  return;
}

scheduleStore.acceptCommittedSchedule(result.data);
```

### Constructor options

| Option | Required | Meaning |
| --- | --- | --- |
| `transport` | yes | Object implementing `send(request, { signal })`. |
| `defaultTimeoutMs` | no | Positive integer; defaults to 15 seconds. `null` disables it. |
| `clientName` | no | Diagnostic client identifier in request metadata. |
| `clientVersion` | no | Deployed build identifier, independent from protocol version. |
| `requestIdFactory` | no | Test/host override returning a 1-128 character string. |
| `now` | no | Test/host clock override returning epoch milliseconds. |

### `execute(operation, payload, options)`

- `operation` is a lower-case identifier separated by dots, dashes, or
  underscores, for example `tasks.query` or `schedule.commit`.
- `payload` must be a plain object. It is cloned and serialized before delivery.
- `operationVersion` is a positive integer and defaults to `1`.
- `idempotencyKey` is optional and accepts 1-128 letters, digits, dots,
  underscores, colons, or dashes.
- `timeoutMs` overrides the gateway default. `null` disables the call deadline.
- `signal` is an optional caller-owned `AbortSignal`.

`execute` resolves with a normalized result for validation, application, network,
HTTP, timeout, cancellation, serialization, and protocol failures. Transport
rejection does not become ordinary exception control flow in application commands.
Construction still throws synchronously for invalid composition, because the
application cannot run with a missing or malformed transport.

## Transport contract

A transport implements:

```js
transport.send(requestEnvelope, { signal })
  -> Promise<responseEnvelope>
```

The transport MUST:

- use the supplied composed signal for cancellable work;
- return the shared response envelope rather than a transport-specific success;
- throw `BridgeError` for delivery failures without a valid response;
- never call a renderer, mutate application state, or apply Gantt domain rules.

The gateway owns the deadline. It combines the caller signal and timeout into the
single signal passed to the transport. Fetch therefore has no second timer with
different semantics.

## JS to PHP request contract

Fetch sends UTF-8 JSON with `POST`:

```json
{
  "operation": "schedule.commit",
  "payload": {
    "projectId": "project-1",
    "taskId": "task-7",
    "startDate": "2026-08-20T00:00:00.000Z",
    "endDate": "2026-08-22T00:00:00.000Z"
  },
  "meta": {
    "requestId": "13cc7bc7-d6ef-4446-a365-4977a40ad051",
    "protocolVersion": "1.0",
    "operationVersion": 1,
    "clientName": "gantt-engine",
    "clientVersion": "experimental",
    "sentAt": "2026-08-15T00:00:00.000Z",
    "idempotencyKey": "drag-task-7-018f6f9a"
  }
}
```

When present, `Idempotency-Key` repeats the metadata value in an HTTP header.
`X-PMIS-Bridge-Version` carries the protocol version so the endpoint can reject
unsupported versions before dispatch. The body remains authoritative for schema
validation and audit correlation.

An operation name is an allowlisted application capability. It is never a PHP
function, class, method, filename, SQL fragment, URL suffix, or reflection target.
PHP maps `(operation, operationVersion)` through an explicit dispatch table.

## PHP to JS response contract

Both success and failure contain exactly four top-level fields:

```json
{
  "ok": true,
  "data": {
    "revision": 9,
    "affectedTaskIds": ["task-7", "task-12"]
  },
  "error": null,
  "meta": {
    "requestId": "13cc7bc7-d6ef-4446-a365-4977a40ad051",
    "protocolVersion": "1.0",
    "operation": "schedule.commit",
    "operationVersion": 1,
    "servedAt": "2026-08-15T00:00:00.041Z"
  }
}
```

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "The schedule changed after the command was prepared.",
    "retryable": false,
    "details": {
      "expectedRevision": 8,
      "currentRevision": 9
    }
  },
  "meta": {
    "requestId": "13cc7bc7-d6ef-4446-a365-4977a40ad051",
    "protocolVersion": "1.0",
    "operation": "schedule.commit",
    "operationVersion": 1,
    "servedAt": "2026-08-15T00:00:00.041Z"
  }
}
```

Rules:

- Success sets `ok: true`, supplies JSON-compatible `data`, and sets `error: null`.
- Failure sets `ok: false`, `data: null`, and all four error fields.
- `error.details` is required; use `null` when empty.
- Response request ID, protocol version, and operation must match the request.
  A mismatch becomes `PROTOCOL_ERROR`.
- The gateway adds authoritative client timing (`startedAt`, `finishedAt`, and
  `durationMs`) plus transport name to returned metadata.
- HTTP metadata such as `httpStatus` may appear in `meta`. Command decisions use
  `error.code`, not transport-specific fields.
- PHP returns `Content-Type: application/json; charset=utf-8` and no notices,
  warnings, debug HTML, or byte-order mark before the JSON.

## Serialization rules

| Value | Rule |
| --- | --- |
| `null`, boolean, string | Preserved. |
| number | Finite; integers within JS safe range; negative zero becomes zero. |
| `Date` | Converted with `toISOString()` to an ISO-8601 UTC string. |
| array | Order preserved; members serialized recursively. |
| plain object | Enumerable string keys preserved; values serialized recursively. |
| `undefined`, `BigInt`, function, symbol | Rejected with `SERIALIZATION_ERROR`. |
| `NaN`, positive/negative infinity | Rejected with `SERIALIZATION_ERROR`. |
| cyclic graph | Rejected with `SERIALIZATION_ERROR`. |
| class, `Map`, `Set`, typed array, binary/blob | Rejected; adapt explicitly. |

Object keys `__proto__`, `constructor`, and `prototype` are rejected. Payload
depth is limited to 64 levels. This keeps behavior deterministic across JSON,
JavaScript objects, and PHP values.

Dates are strings on the wire. Each operation schema identifies date fields and
validates their time-zone/calendar meaning. The bridge never guesses that an
arbitrary string is a date.

PHP should decode JSON with exceptions enabled and preserve the distinction
between JSON objects and lists during validation. Associative-array decoding must
handle the empty-object/empty-list ambiguity explicitly. Never use PHP
`serialize()` or `unserialize()` for this boundary.

## Error taxonomy

| Code | Meaning | Typical HTTP | Retry guidance |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | Envelope, payload, or domain input invalid. | 400/422 | Correct input. |
| `UNKNOWN_OPERATION` | Operation/version absent from allowlist. | 404 | Do not retry unchanged. |
| `AUTH_REQUIRED` | No valid authenticated actor. | 401 | Re-authenticate. |
| `FORBIDDEN` | Actor lacks resource/operation permission. | 403 | Do not retry unchanged. |
| `NOT_FOUND` | Resource absent or not visible. | 404 | Refresh/correct identity. |
| `CONFLICT` | Revision, state, or domain precondition conflict. | 409 | Refresh first. |
| `IDEMPOTENCY_CONFLICT` | Key reused with different payload. | 409 | New key for new intent. |
| `RATE_LIMITED` | Rate policy rejected request. | 429 | Follow server policy. |
| `TIMEOUT` | Client or explicitly normalized upstream deadline. | 408 | Mutation outcome may be unknown. |
| `CANCELLED` | Caller cancelled locally. | none | Not a server failure. |
| `NETWORK_ERROR` | Endpoint could not be reached/read. | none | Retry safely. |
| `HTTP_ERROR` | Unstructured HTTP failure. | other 4xx/5xx | Infrastructure failure. |
| `PROTOCOL_ERROR` | Malformed/mismatched response. | any | Fix compatibility. |
| `SERIALIZATION_ERROR` | JS value cannot cross JSON safely. | none | Fix adapter/input. |
| `UNAVAILABLE` | Endpoint/dependency temporarily unavailable. | 502/503/504 | Follow policy. |
| `INTERNAL_ERROR` | Unexpected application/bridge failure. | 500 | Log by request ID. |

PHP failures return the most specific normalized error. Fetch maps only
unstructured HTTP failures. Server messages must not expose SQL, stack traces,
filesystem paths, secrets, or authorization internals. Unserializable internal
error details are discarded rather than causing a second bridge failure.

## Timeout and cancellation

The gateway creates one composed signal for every call:

- caller abort produces `CANCELLED`;
- gateway deadline produces `TIMEOUT`;
- whichever occurs first wins;
- listeners and timers are removed when the call settles;
- the returned Promise resolves to a failure result.

The gateway races delivery against this signal, so it returns even if a custom
handler ignores cancellation. Such work may continue. Transports and handlers
must observe `context.signal`, stop expensive work, and avoid committing after
abort where possible.

HTTP cancellation cannot prove PHP did not commit. A timed-out or cancelled
mutation has an unknown remote outcome. Query current state or retry using the
same idempotency key; never issue a new key for the same user intent.

## In-memory transport

```js
import { InMemoryTransport } from "./src/bridge/transports.mjs";

const transport = new InMemoryTransport({
  handlers: {
    "tasks.query": () => ({ tasks: fixtureTasks }),
    "schedule.commit": (command, context) =>
      scheduleService.commit(command, context),
  },
  latencyMs: 0,
});
```

Handlers receive serialized payload plus operation, operation version, request
ID, idempotency key, and signal. A handler returns data or throws `BridgeError`.

Completed results replay when operation/version/key and canonical payload recur.
The same key with different payload returns `IDEMPOTENCY_CONFLICT`. The cache is
process-local, non-durable, does not scope by actor, and does not deduplicate
concurrent in-flight requests. It is demo behavior, not the PHP persistence plan.

## Fetch transport

```js
import { Gateway } from "./src/bridge/index.mjs";
import { FetchTransport } from "./src/bridge/transports.mjs";

const transport = new FetchTransport({
  endpoint: "/api/gantt/bridge",
  credentials: "same-origin",
  headerProvider: () => ({
    "X-CSRF-Token": csrfTokenStore.current(),
  }),
});

export const gateway = new Gateway({ transport });
```

Fetch uses the platform API and no third-party package. It sends POST JSON with
`Accept`, `Content-Type`, protocol header, composed signal, and same-origin
credentials. `headerProvider` may supply request-time CSRF/correlation headers.
It belongs in composition and must not read tokens from rendered components.

The endpoint is injected. `/api/gantt/bridge` may route to a PHP front controller
through Apache, nginx, a PHP development server, or another host without changing
application commands or renderer code.

## Future PHP endpoint responsibilities

In order, the PHP boundary must:

1. accept only configured method and JSON content type;
2. apply request/body size and rate limits;
3. decode JSON with exceptions and validate the envelope;
4. reject unsupported protocol versions before dispatch;
5. resolve actor from server-trusted session/token state;
6. validate CSRF for cookie-authenticated mutation;
7. allowlist `(operation, operationVersion)`;
8. validate the operation payload schema;
9. authorize actor against project/resource and command responsibility;
10. claim or replay idempotency for mutating operations;
11. invoke the application service in the required transaction;
12. commit domain changes, downstream effects, and Change Record/audit data
    atomically where required;
13. persist the completed idempotent response;
14. return the normalized envelope with original request ID;
15. log internal diagnostics by request and actor ID.

The endpoint must not:

- use operation strings for reflection or dynamic file inclusion;
- trust actor, tenant, ownership, or role claims in payload;
- contain SVG geometry, DOM/view state, hover/selection, or invalidation logic;
- expose repository records without an application response adapter;
- reimplement forward-only scheduling differently from the domain service;
- return raw PHP exceptions, warnings, or notices.

Separate handlers may own operations, while the HTTP adapter owns common
envelope, authentication, idempotency, transaction, and error mapping concerns.

## Security and authentication boundary

Authentication and authorization are PHP/server responsibilities. JavaScript
transports credentials but never decides identity or permissions.

- Prefer secure `HttpOnly`, `SameSite` cookies where hosting permits. JavaScript
  must not read an HttpOnly session secret.
- Cookie-authenticated mutations require CSRF protection. Composition may inject
  a CSRF header through `headerProvider`.
- If bearer tokens are selected later, a dedicated auth/composition adapter owns
  them, never a renderer or task payload.
- PHP derives actor and project access from trusted state and authorizes every
  operation.
- CORS denies unapproved origins; same-origin is the default fetch policy.
- Future repositories use parameterized database access.
- Server validation covers IDs, lengths, collection sizes, dates, and operation
  limits even when JavaScript has validated the envelope.
- Logs may include request ID, operation, actor ID, result, and duration, but
  redact credentials and sensitive payloads.

Authorization may return `NOT_FOUND` instead of `FORBIDDEN` where revealing
resource existence leaks information. That policy belongs to PHP.

## Idempotency contract

Every retriable mutation carries an idempotency key. One completed Gantt drag is
one intent and one key; all recursive forward-propagation effects remain in the
same command.

The PHP uniqueness scope is equivalent to:

```text
(authenticated principal or tenant, operation, operation version, idempotency key)
```

Store canonical payload hash, lifecycle state, HTTP status, normalized response,
and expiry/audit timestamps.

- First request claims the key and executes.
- Same key and canonical payload replays the completed result.
- Same key and different payload returns `IDEMPOTENCY_CONFLICT`.
- Concurrent duplicate waits for/replays the first within a bounded policy; it
  must not execute twice.
- New user intent gets a new key.
- Browser-only cancellation is not a server result and cannot overwrite a
  committed response.

Idempotency does not replace optimistic revisions. A command may still return
`CONFLICT` when its expected project revision is stale.

## Versioning contract

Three versions remain distinct:

1. `protocolVersion` controls common envelope and transport semantics.
2. `operationVersion` controls one operation's payload/data schema.
3. `clientVersion` identifies the deployed JavaScript build for diagnostics.

Protocol `1.0` uses major/minor notation, but this implementation negotiates an
exact string: the response must echo the request version. A breaking envelope
change requires a new major. Compatible diagnostic fields may be added inside
`meta` without changing `1.0`; a future minor must be explicitly supported by
both client and server before it is emitted.

Operation evolution uses a new positive integer. PHP may support adjacent
versions simultaneously and adapt each to one application service. Never infer
operation schema from `clientVersion`.

Unsupported protocol or operation version returns a normalized
`PROTOCOL_ERROR` or `UNKNOWN_OPERATION`, using a status that still permits the
JSON error envelope to reach the client.

## Verification strategy

Run the dependency-free bridge contract directly:

```text
node --test experimental/gantt-engine/tests/php-bridge.test.mjs
```

The suite verifies exact result shape, operation dispatch, Date conversion,
unsafe-value rejection, idempotent replay/conflict, caller cancellation, timeout,
fetch envelope/headers/signal, structured HTTP errors, network failures,
content-type/JSON validation, response correlation, and import separation.

When PHP exists, integration tests should start it against an isolated database
and send the same fixtures through `FetchTransport`. Cover authentication, CSRF,
authorization, transaction rollback, concurrent idempotency, revision conflict,
and response compatibility.

Playwright tests behavior at the user boundary: delegated click invokes one
application command, pending UI can cancel, success updates state once, failure
leaves committed state unchanged, and retry does not duplicate mutation. Page
objects must not call transport or assert PHP class/function names.

## Explicit non-goals

- No PHP implementation or server process.
- No database, session, CSRF, or token implementation.
- No renderer invalidation or component framework in this boundary.
- No full Gantt operation catalog beyond examples.
- No third-party HTTP, schema, RPC, retry, or cancellation package.
- No automatic retry of mutating operations.
