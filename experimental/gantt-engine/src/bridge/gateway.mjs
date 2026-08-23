import {
  createOperationCancellation,
  raceWithSignal,
  throwIfAborted,
} from "./cancellation.mjs";
import { asBridgeError, BridgeError, ERROR_CODES } from "./errors.mjs";
import {
  BRIDGE_PROTOCOL_VERSION,
  createFailureResult,
  normalizeResponseEnvelope,
  validateIdempotencyKey,
  validateOperationName,
  validateOperationVersion,
  validateTimeout,
} from "./protocol.mjs";
import { serializeObjectPayload } from "./serialization.mjs";

let fallbackRequestSequence = 0;

function defaultRequestIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackRequestSequence += 1;
  return `bridge-${Date.now().toString(36)}-${fallbackRequestSequence.toString(36)}`;
}

function isoTime(timestamp) {
  return new Date(timestamp).toISOString();
}

function assertRequestId(requestId) {
  if (
    typeof requestId !== "string" ||
    requestId.length < 1 ||
    requestId.length > 128
  ) {
    throw new BridgeError(
      ERROR_CODES.INTERNAL_ERROR,
      "The request ID factory must return a string containing 1-128 characters.",
    );
  }
  return requestId;
}

function buildResultMeta({
  requestId,
  operation,
  operationVersion,
  transportName,
  startedAt,
  finishedAt,
  responseMeta = {},
}) {
  return {
    ...responseMeta,
    requestId,
    operation,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    operationVersion,
    transport: transportName,
    startedAt: isoTime(startedAt),
    finishedAt: isoTime(finishedAt),
    durationMs: Math.max(0, finishedAt - startedAt),
  };
}

/**
 * Application command handlers call this gateway. Views and renderers must not
 * import a concrete transport; the application composition root injects one.
 */
export class Gateway {
  constructor(options) {
    if (!options?.transport || typeof options.transport.send !== "function") {
      throw new TypeError(
        "Gateway requires a transport with a send(request, context) method.",
      );
    }

    this.transport = options.transport;
    this.transportName = options.transport.name ?? "custom";
    this.defaultTimeoutMs = validateTimeout(options.defaultTimeoutMs ?? 15_000);
    this.clientName = options.clientName ?? "gantt-engine";
    this.clientVersion = options.clientVersion ?? "experimental";
    this.requestIdFactory = options.requestIdFactory ?? defaultRequestIdFactory;
    this.now = options.now ?? Date.now;

    if (
      typeof this.requestIdFactory !== "function" ||
      typeof this.now !== "function"
    ) {
      throw new TypeError("requestIdFactory and now must be functions.");
    }
  }

  async execute(operation, payload = {}, options = {}) {
    const startedAt = this.now();
    let requestId = "unassigned";
    let operationVersion = 1;
    let cancellation = null;

    try {
      requestId = assertRequestId(this.requestIdFactory());
      const validatedOperation = validateOperationName(operation);
      operationVersion = validateOperationVersion(
        options.operationVersion ?? 1,
      );
      const timeoutMs = validateTimeout(
        options.timeoutMs === undefined
          ? this.defaultTimeoutMs
          : options.timeoutMs,
      );
      const idempotencyKey = validateIdempotencyKey(options.idempotencyKey);
      const serializedPayload = serializeObjectPayload(payload);

      cancellation = createOperationCancellation(options.signal, timeoutMs);
      const request = {
        operation: validatedOperation,
        payload: serializedPayload,
        meta: {
          requestId,
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          operationVersion,
          clientName: this.clientName,
          clientVersion: this.clientVersion,
          sentAt: isoTime(startedAt),
          idempotencyKey,
        },
      };

      throwIfAborted(cancellation.signal);
      const transportPromise = Promise.resolve().then(() =>
        this.transport.send(request, { signal: cancellation.signal }),
      );
      const response = await raceWithSignal(
        transportPromise,
        cancellation.signal,
      );
      const normalized = normalizeResponseEnvelope(response, request);
      const finishedAt = this.now();

      return {
        ...normalized,
        meta: buildResultMeta({
          requestId,
          operation: validatedOperation,
          operationVersion,
          transportName: this.transportName,
          startedAt,
          finishedAt,
          responseMeta: normalized.meta,
        }),
      };
    } catch (error) {
      const finishedAt = this.now();
      const safeOperation = typeof operation === "string" ? operation : null;
      return createFailureResult(
        asBridgeError(error),
        buildResultMeta({
          requestId,
          operation: safeOperation,
          operationVersion,
          transportName: this.transportName,
          startedAt,
          finishedAt,
        }),
      );
    } finally {
      cancellation?.cleanup();
    }
  }
}

export function createBridge(options) {
  return new Gateway(options);
}
