import { throwIfAborted } from "./cancellation.mjs";
import {
  asBridgeError,
  BridgeError,
  ERROR_CODES,
  toErrorDescriptor,
} from "./errors.mjs";
import { canonicalJson, serializeForTransport } from "./serialization.mjs";

function createResponseMeta(request, now, extra = {}) {
  return {
    requestId: request.meta.requestId,
    protocolVersion: request.meta.protocolVersion,
    operation: request.operation,
    operationVersion: request.meta.operationVersion,
    servedAt: new Date(now()).toISOString(),
    transport: "memory",
    ...extra,
  };
}

function failureResponse(request, error, now, extraMeta = {}) {
  const descriptor = toErrorDescriptor(error);
  return {
    ok: false,
    data: null,
    error: {
      ...descriptor,
      details: serializeForTransport(descriptor.details),
    },
    meta: createResponseMeta(request, now, extraMeta),
  };
}

function waitForLatency(delayMs, signal) {
  if (delayMs <= 0) {
    throwIfAborted(signal);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    const onAbort = () => {
      cleanup();
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class InMemoryTransport {
  constructor(options = {}) {
    this.name = "memory";
    this.handlers = new Map();
    this.completedIdempotentResults = new Map();
    this.latencyMs = options.latencyMs ?? 0;
    this.now = options.now ?? Date.now;

    if (!Number.isSafeInteger(this.latencyMs) || this.latencyMs < 0) {
      throw new TypeError(
        "InMemoryTransport latencyMs must be a non-negative integer.",
      );
    }

    const handlers = options.handlers ?? {};
    const entries =
      handlers instanceof Map ? handlers.entries() : Object.entries(handlers);
    for (const [operation, handler] of entries) {
      this.register(operation, handler);
    }
  }

  register(operation, handler) {
    if (typeof operation !== "string" || typeof handler !== "function") {
      throw new TypeError(
        "In-memory handlers require an operation name and function.",
      );
    }
    this.handlers.set(operation, handler);
    return this;
  }

  unregister(operation) {
    return this.handlers.delete(operation);
  }

  async send(request, context = {}) {
    const { signal } = context;
    throwIfAborted(signal);
    await waitForLatency(this.latencyMs, signal);

    const idempotencyKey = request.meta.idempotencyKey;
    const cacheKey = idempotencyKey
      ? `${request.operation}:${request.meta.operationVersion}:${idempotencyKey}`
      : null;
    const fingerprint = cacheKey ? canonicalJson(request.payload) : null;
    const cached = cacheKey
      ? this.completedIdempotentResults.get(cacheKey)
      : null;

    if (cached && cached.fingerprint !== fingerprint) {
      return failureResponse(
        request,
        new BridgeError(
          ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "The idempotency key was already used with a different payload.",
          { details: { idempotencyKey } },
        ),
        this.now,
      );
    }

    if (cached) {
      return {
        ...serializeForTransport(cached.response),
        meta: createResponseMeta(request, this.now, { idempotentReplay: true }),
      };
    }

    const handler = this.handlers.get(request.operation);
    if (!handler) {
      return failureResponse(
        request,
        new BridgeError(
          ERROR_CODES.UNKNOWN_OPERATION,
          `No in-memory handler is registered for ${request.operation}.`,
        ),
        this.now,
      );
    }

    let response;
    try {
      const data = await handler(request.payload, {
        operation: request.operation,
        operationVersion: request.meta.operationVersion,
        requestId: request.meta.requestId,
        idempotencyKey,
        signal,
      });
      throwIfAborted(signal);
      response = {
        ok: true,
        data: serializeForTransport(data, { path: "handler result" }),
        error: null,
        meta: createResponseMeta(request, this.now, {
          idempotentReplay: false,
        }),
      };
    } catch (error) {
      const bridgeError = asBridgeError(error);
      if (
        bridgeError.code === ERROR_CODES.CANCELLED ||
        bridgeError.code === ERROR_CODES.TIMEOUT
      ) {
        throw bridgeError;
      }
      response = failureResponse(request, bridgeError, this.now, {
        idempotentReplay: false,
      });
    }

    if (cacheKey) {
      this.completedIdempotentResults.set(cacheKey, {
        fingerprint,
        response: serializeForTransport(response),
      });
    }
    return response;
  }
}
