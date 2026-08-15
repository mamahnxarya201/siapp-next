import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as applicationBridge from "../src/bridge/index.mjs";
import {
  BridgeError,
  ERROR_CODES,
  Gateway,
} from "../src/bridge/index.mjs";
import {
  FetchTransport,
  InMemoryTransport,
} from "../src/bridge/transports.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_SOURCE_DIRECTORY = path.resolve(TEST_DIRECTORY, "../src");

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listSourceFiles(fullPath) : [fullPath];
    }),
  );
  return nestedFiles.flat();
}

function requestIds(prefix = "request") {
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}

function gatewayFor(transport, options = {}) {
  return new Gateway({
    transport,
    defaultTimeoutMs: 100,
    requestIdFactory: requestIds(),
    now: () => Date.parse("2026-08-15T00:00:00.000Z"),
    ...options,
  });
}

function responseFromRequest(request, overrides = {}) {
  return {
    ok: true,
    data: { accepted: true },
    error: null,
    meta: {
      requestId: request.meta.requestId,
      protocolVersion: request.meta.protocolVersion,
      operation: request.operation,
      operationVersion: request.meta.operationVersion,
      servedAt: "2026-08-15T00:00:00.000Z",
    },
    ...overrides,
  };
}

function fakeHttpResponse({
  status = 200,
  body,
  headers = { "content-type": "application/json; charset=utf-8" },
}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Request Failed",
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    async text() {
      return body;
    },
  };
}

test("application bridge surface does not export concrete transports", () => {
  assert.equal("FetchTransport" in applicationBridge, false);
  assert.equal("InMemoryTransport" in applicationBridge, false);
  assert.equal(typeof applicationBridge.Gateway, "function");
});

test("view and renderer modules cannot import transports or PHP endpoint details", async () => {
  const files = await listSourceFiles(ENGINE_SOURCE_DIRECTORY);
  const viewAndRendererFiles = files.filter((file) =>
    /(?:view|renderer)/i.test(path.basename(file)),
  );
  const forbiddenPattern =
    /(?:bridge\/(?:transports|fetch-transport|in-memory-transport)|\.php\b|\/api\/[^"'\s]*bridge|\bfetch\s*\(|\bXMLHttpRequest\b|\bEventSource\b|\bWebSocket\b|Idempotency-Key)/i;

  for (const file of viewAndRendererFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, forbiddenPattern, path.relative(ENGINE_SOURCE_DIRECTORY, file));
  }
});

test("Gateway executes a named operation and always returns the normalized shape", async () => {
  let receivedPayload;
  let receivedContext;
  const transport = new InMemoryTransport({
    handlers: {
      "schedule.commit": async (payload, context) => {
        receivedPayload = payload;
        receivedContext = context;
        return {
          taskId: payload.taskId,
          savedAt: new Date("2026-08-15T01:02:03.000Z"),
        };
      },
    },
  });
  const gateway = gatewayFor(transport);

  const result = await gateway.execute(
    "schedule.commit",
    {
      taskId: "task-7",
      startDate: new Date("2026-08-20T00:00:00.000Z"),
    },
    { operationVersion: 2 },
  );

  assert.deepEqual(Object.keys(result).sort(), ["data", "error", "meta", "ok"]);
  assert.equal(result.ok, true);
  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    taskId: "task-7",
    savedAt: "2026-08-15T01:02:03.000Z",
  });
  assert.equal(receivedPayload.startDate, "2026-08-20T00:00:00.000Z");
  assert.equal(receivedContext.operationVersion, 2);
  assert.equal(result.meta.operation, "schedule.commit");
  assert.equal(result.meta.operationVersion, 2);
  assert.equal(result.meta.transport, "memory");
});

test("Gateway normalizes application errors raised by an in-memory handler", async () => {
  const gateway = gatewayFor(
    new InMemoryTransport({
      handlers: {
        "tasks.update": () => {
          throw new BridgeError(
            ERROR_CODES.VALIDATION_ERROR,
            "endDate must not precede startDate.",
            { details: { field: "endDate" } },
          );
        },
      },
    }),
  );

  const result = await gateway.execute("tasks.update", { taskId: "task-1" });

  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.deepEqual(result.error, {
    code: ERROR_CODES.VALIDATION_ERROR,
    message: "endDate must not precede startDate.",
    retryable: false,
    details: { field: "endDate" },
  });
});

test("In-memory transport reports an unknown named operation", async () => {
  const result = await gatewayFor(new InMemoryTransport()).execute("tasks.missing", {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.UNKNOWN_OPERATION);
});

test("Gateway rejects values that cannot cross the JSON boundary", async (t) => {
  const gateway = gatewayFor(
    new InMemoryTransport({ handlers: { "tasks.create": (payload) => payload } }),
  );

  await t.test("undefined", async () => {
    const result = await gateway.execute("tasks.create", { title: undefined });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, ERROR_CODES.SERIALIZATION_ERROR);
  });

  await t.test("BigInt", async () => {
    const result = await gateway.execute("tasks.create", { estimate: 4n });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, ERROR_CODES.SERIALIZATION_ERROR);
  });

  await t.test("unsafe integer", async () => {
    const result = await gateway.execute("tasks.create", {
      revision: Number.MAX_SAFE_INTEGER + 1,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, ERROR_CODES.SERIALIZATION_ERROR);
  });
});

test("In-memory transport replays completed idempotent operations and detects key reuse", async () => {
  let calls = 0;
  const gateway = gatewayFor(
    new InMemoryTransport({
      handlers: {
        "schedule.commit": ({ taskId }) => ({ taskId, revision: ++calls }),
      },
    }),
  );

  const first = await gateway.execute(
    "schedule.commit",
    { taskId: "task-1" },
    { idempotencyKey: "gesture-123" },
  );
  const replay = await gateway.execute(
    "schedule.commit",
    { taskId: "task-1" },
    { idempotencyKey: "gesture-123" },
  );
  const conflict = await gateway.execute(
    "schedule.commit",
    { taskId: "task-2" },
    { idempotencyKey: "gesture-123" },
  );

  assert.equal(first.ok, true);
  assert.equal(replay.ok, true);
  assert.deepEqual(replay.data, first.data);
  assert.equal(replay.meta.idempotentReplay, true);
  assert.equal(calls, 1);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.code, ERROR_CODES.IDEMPOTENCY_CONFLICT);
});

test("Gateway turns its deadline into a TIMEOUT result even if a handler never settles", async () => {
  const gateway = gatewayFor(
    new InMemoryTransport({
      handlers: { "schedule.commit": () => new Promise(() => {}) },
    }),
    { defaultTimeoutMs: 10 },
  );

  const result = await gateway.execute("schedule.commit", {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.TIMEOUT);
  assert.equal(result.error.retryable, false);
  assert.deepEqual(result.error.details, { timeoutMs: 10 });
});

test("Gateway turns caller AbortSignal cancellation into a CANCELLED result", async () => {
  const controller = new AbortController();
  const gateway = gatewayFor(
    new InMemoryTransport({
      handlers: { "schedule.commit": () => new Promise(() => {}) },
    }),
    { defaultTimeoutMs: 1_000 },
  );

  const pending = gateway.execute("schedule.commit", {}, { signal: controller.signal });
  controller.abort("user navigated away");
  const result = await pending;

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.CANCELLED);
});

test("Gateway handles an already-aborted caller signal without invoking transport", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const transport = {
    name: "test",
    async send() {
      calls += 1;
      return null;
    },
  };

  const result = await gatewayFor(transport).execute(
    "tasks.query",
    {},
    { signal: controller.signal },
  );

  assert.equal(result.error.code, ERROR_CODES.CANCELLED);
  assert.equal(calls, 0);
});

test("FetchTransport sends the wire envelope, auth headers, signal, and idempotency key", async () => {
  let observed;
  const fetchImpl = async (url, init) => {
    const request = JSON.parse(init.body);
    observed = { url, init, request };
    return fakeHttpResponse({
      body: JSON.stringify(responseFromRequest(request, { data: { revision: 9 } })),
    });
  };
  const transport = new FetchTransport({
    endpoint: "/api/gantt/bridge",
    fetchImpl,
    headerProvider: () => ({ "X-CSRF-Token": "csrf-test-token" }),
  });
  const gateway = gatewayFor(transport);

  const result = await gateway.execute(
    "schedule.commit",
    { taskId: "task-9" },
    { idempotencyKey: "drag-task-9-1" },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { revision: 9 });
  assert.equal(observed.url, "/api/gantt/bridge");
  assert.equal(observed.init.method, "POST");
  assert.equal(observed.init.credentials, "same-origin");
  assert.equal(observed.init.headers["X-CSRF-Token"], "csrf-test-token");
  assert.equal(observed.init.headers["Idempotency-Key"], "drag-task-9-1");
  assert.equal(observed.request.operation, "schedule.commit");
  assert.equal(observed.init.signal instanceof AbortSignal, true);
});

test("FetchTransport preserves a normalized PHP error on a non-2xx response", async () => {
  const fetchImpl = async (_url, init) => {
    const request = JSON.parse(init.body);
    return fakeHttpResponse({
      status: 403,
      body: JSON.stringify(
        responseFromRequest(request, {
          ok: false,
          data: null,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: "The actor cannot edit this project.",
            retryable: false,
            details: { projectId: "project-1" },
          },
        }),
      ),
    });
  };
  const gateway = gatewayFor(
    new FetchTransport({ endpoint: "/api/gantt/bridge", fetchImpl }),
  );

  const result = await gateway.execute("schedule.commit", { projectId: "project-1" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.FORBIDDEN);
  assert.equal(result.meta.httpStatus, 403);
});

test("FetchTransport converts connection failures into retryable NETWORK_ERROR results", async () => {
  const gateway = gatewayFor(
    new FetchTransport({
      endpoint: "/api/gantt/bridge",
      fetchImpl: async () => {
        throw new TypeError("connection refused");
      },
    }),
  );

  const result = await gateway.execute("tasks.query", {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.NETWORK_ERROR);
  assert.equal(result.error.retryable, true);
});

test("Gateway rejects malformed or mismatched transport responses as PROTOCOL_ERROR", async (t) => {
  await t.test("invalid JSON", async () => {
    const gateway = gatewayFor(
      new FetchTransport({
        endpoint: "/api/gantt/bridge",
        fetchImpl: async () => fakeHttpResponse({ body: "not-json" }),
      }),
    );
    const result = await gateway.execute("tasks.query", {});
    assert.equal(result.error.code, ERROR_CODES.PROTOCOL_ERROR);
  });

  await t.test("mismatched request ID", async () => {
    const transport = {
      name: "test",
      async send(request) {
        const response = responseFromRequest(request);
        response.meta.requestId = "different-request";
        return response;
      },
    };
    const result = await gatewayFor(transport).execute("tasks.query", {});
    assert.equal(result.error.code, ERROR_CODES.PROTOCOL_ERROR);
  });

  await t.test("missing JSON content type", async () => {
    const gateway = gatewayFor(
      new FetchTransport({
        endpoint: "/api/gantt/bridge",
        fetchImpl: async (_url, init) => {
          const request = JSON.parse(init.body);
          return fakeHttpResponse({
            body: JSON.stringify(responseFromRequest(request)),
            headers: {},
          });
        },
      }),
    );
    const result = await gateway.execute("tasks.query", {});
    assert.equal(result.error.code, ERROR_CODES.PROTOCOL_ERROR);
  });

  await t.test("non-JSON transport data", async () => {
    const transport = {
      name: "test",
      async send(request) {
        return responseFromRequest(request, { data: { revision: 1n } });
      },
    };
    const result = await gatewayFor(transport).execute("tasks.query", {});
    assert.equal(result.error.code, ERROR_CODES.PROTOCOL_ERROR);
  });
});

test("Gateway drops unserializable error details while preserving the known error", async () => {
  const transport = {
    name: "test",
    async send() {
      throw new BridgeError(ERROR_CODES.CONFLICT, "Revision conflict.", {
        details: { currentRevision: 1n },
      });
    },
  };

  const result = await gatewayFor(transport).execute("schedule.commit", {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, ERROR_CODES.CONFLICT);
  assert.equal(result.error.details, null);
});
