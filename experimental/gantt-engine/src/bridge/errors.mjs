export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNKNOWN_OPERATION: "UNKNOWN_OPERATION",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  TIMEOUT: "TIMEOUT",
  CANCELLED: "CANCELLED",
  NETWORK_ERROR: "NETWORK_ERROR",
  HTTP_ERROR: "HTTP_ERROR",
  PROTOCOL_ERROR: "PROTOCOL_ERROR",
  SERIALIZATION_ERROR: "SERIALIZATION_ERROR",
  UNAVAILABLE: "UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

const KNOWN_ERROR_CODES = new Set(Object.values(ERROR_CODES));

export function isKnownErrorCode(code) {
  return typeof code === "string" && KNOWN_ERROR_CODES.has(code);
}

export class BridgeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "BridgeError";
    this.code = isKnownErrorCode(code) ? code : ERROR_CODES.INTERNAL_ERROR;
    this.retryable = options.retryable === true;
    this.details = options.details ?? null;
  }
}

export function asBridgeError(error, fallbackCode = ERROR_CODES.INTERNAL_ERROR) {
  if (error instanceof BridgeError) {
    return error;
  }

  if (error?.name === "AbortError") {
    return new BridgeError(ERROR_CODES.CANCELLED, "The operation was cancelled.", {
      cause: error,
    });
  }

  const message =
    fallbackCode === ERROR_CODES.INTERNAL_ERROR
      ? "The bridge operation failed unexpectedly."
      : error instanceof Error && error.message
        ? error.message
        : "The bridge operation failed unexpectedly.";

  return new BridgeError(fallbackCode, message, { cause: error });
}

export function toErrorDescriptor(error, fallbackCode = ERROR_CODES.INTERNAL_ERROR) {
  const bridgeError = asBridgeError(error, fallbackCode);

  return {
    code: bridgeError.code,
    message: bridgeError.message,
    retryable: bridgeError.retryable,
    details: bridgeError.details,
  };
}
