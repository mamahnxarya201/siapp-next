import {
  BridgeError,
  ERROR_CODES,
  isKnownErrorCode,
  toErrorDescriptor,
} from "./errors.mjs";
import { serializeForTransport } from "./serialization.mjs";

export const BRIDGE_PROTOCOL_VERSION = "1.0";

const OPERATION_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const RESPONSE_KEYS = new Set(["ok", "data", "error", "meta"]);

function isPlainObject(value) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function protocolError(message, details = null) {
  return new BridgeError(ERROR_CODES.PROTOCOL_ERROR, message, { details });
}

function serializeResponseValue(value, path) {
  try {
    return serializeForTransport(value, { path });
  } catch (error) {
    throw protocolError(`${path} is not valid bridge JSON.`, {
      reason: error instanceof Error ? error.message : "serialization failed",
    });
  }
}

function serializeErrorDetails(details) {
  try {
    return serializeForTransport(details, { path: "result.error.details" });
  } catch {
    return null;
  }
}

export function validateOperationName(operation) {
  if (typeof operation !== "string" || !OPERATION_PATTERN.test(operation)) {
    throw new BridgeError(
      ERROR_CODES.VALIDATION_ERROR,
      "Operation names must be lower-case dot, dash, or underscore separated identifiers.",
      { details: { operation: typeof operation === "string" ? operation : null } },
    );
  }
  return operation;
}

export function validateOperationVersion(version) {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new BridgeError(
      ERROR_CODES.VALIDATION_ERROR,
      "Operation version must be a positive safe integer.",
      { details: { operationVersion: version } },
    );
  }
  return version;
}

export function validateIdempotencyKey(key) {
  if (key === undefined || key === null) {
    return null;
  }
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(key)
  ) {
    throw new BridgeError(
      ERROR_CODES.VALIDATION_ERROR,
      "Idempotency keys must contain 1-128 letters, digits, dots, underscores, colons, or dashes.",
    );
  }
  return key;
}

export function validateTimeout(timeoutMs) {
  if (timeoutMs === null) {
    return null;
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new BridgeError(
      ERROR_CODES.VALIDATION_ERROR,
      "Timeout must be a positive integer in milliseconds or null to disable it.",
    );
  }
  return timeoutMs;
}

export function createSuccessResult(data, meta) {
  return {
    ok: true,
    data: serializeResponseValue(data, "response.data"),
    error: null,
    meta: serializeResponseValue(meta, "response.meta"),
  };
}

export function createFailureResult(error, meta) {
  const descriptor = toErrorDescriptor(error);
  return {
    ok: false,
    data: null,
    error: {
      ...descriptor,
      details: serializeErrorDetails(descriptor.details),
    },
    meta: serializeForTransport(meta, { path: "result.meta" }),
  };
}

function validateMeta(meta, request) {
  if (!isPlainObject(meta)) {
    throw protocolError("Response meta must be a plain object.");
  }

  const serialized = serializeResponseValue(meta, "response.meta");
  if (serialized.requestId !== request.meta.requestId) {
    throw protocolError("Response requestId does not match the request.", {
      expected: request.meta.requestId,
      received: serialized.requestId ?? null,
    });
  }
  if (serialized.protocolVersion !== request.meta.protocolVersion) {
    throw protocolError("Response protocolVersion does not match the request.", {
      expected: request.meta.protocolVersion,
      received: serialized.protocolVersion ?? null,
    });
  }
  if (serialized.operation !== request.operation) {
    throw protocolError("Response operation does not match the request.", {
      expected: request.operation,
      received: serialized.operation ?? null,
    });
  }
  return serialized;
}

function validateErrorDescriptor(error) {
  if (!isPlainObject(error)) {
    throw protocolError("Failed responses must contain an error object.");
  }
  if (!isKnownErrorCode(error.code)) {
    throw protocolError("Response contains an unknown error code.", {
      code: typeof error.code === "string" ? error.code : null,
    });
  }
  if (typeof error.message !== "string" || error.message.length === 0) {
    throw protocolError("Response error.message must be a non-empty string.");
  }
  if (typeof error.retryable !== "boolean") {
    throw protocolError("Response error.retryable must be a boolean.");
  }
  if (!Object.prototype.hasOwnProperty.call(error, "details")) {
    throw protocolError("Response error.details must be present; use null when empty.");
  }

  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    details: serializeResponseValue(error.details, "response.error.details"),
  };
}

export function normalizeResponseEnvelope(response, request) {
  if (!isPlainObject(response)) {
    throw protocolError("Transport response must be a plain object.");
  }

  const keys = Object.keys(response);
  if (
    keys.some((key) => !RESPONSE_KEYS.has(key)) ||
    [...RESPONSE_KEYS].some(
      (key) => !Object.prototype.hasOwnProperty.call(response, key),
    )
  ) {
    throw protocolError(
      "Transport response must contain exactly ok, data, error, and meta.",
    );
  }

  if (typeof response.ok !== "boolean") {
    throw protocolError("Response ok must be a boolean.");
  }

  const meta = validateMeta(response.meta, request);
  if (response.ok) {
    if (response.error !== null) {
      throw protocolError("Successful responses must set error to null.");
    }
    return createSuccessResult(response.data, meta);
  }

  if (response.data !== null) {
    throw protocolError("Failed responses must set data to null.");
  }

  return {
    ok: false,
    data: null,
    error: validateErrorDescriptor(response.error),
    meta,
  };
}
