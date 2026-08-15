import { BridgeError, ERROR_CODES } from "./errors.mjs";

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const DEFAULT_MAX_DEPTH = 64;

function serializationError(path, message) {
  return new BridgeError(
    ERROR_CODES.SERIALIZATION_ERROR,
    `Cannot serialize ${path}: ${message}`,
    { details: { path } },
  );
}

function serializeValue(value, path, ancestors, depth, maxDepth) {
  if (depth > maxDepth) {
    throw serializationError(path, `maximum depth of ${maxDepth} was exceeded`);
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw serializationError(path, "numbers must be finite");
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw serializationError(path, "integers must be within JavaScript's safe range");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw serializationError(path, "Date values must be valid");
    }
    return value.toISOString();
  }

  if (typeof value !== "object") {
    throw serializationError(
      path,
      `${typeof value} values are not part of the JSON bridge contract`,
    );
  }

  if (ancestors.has(value)) {
    throw serializationError(path, "cyclic references are not supported");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        serializeValue(item, `${path}[${index}]`, ancestors, depth + 1, maxDepth),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw serializationError(
        path,
        "only plain objects, arrays, primitives, null, and Date values are supported",
      );
    }

    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw serializationError(path, "symbol-keyed properties are not supported");
    }

    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        throw serializationError(`${path}.${key}`, "this object key is forbidden");
      }
      result[key] = serializeValue(
        item,
        `${path}.${key}`,
        ancestors,
        depth + 1,
        maxDepth,
      );
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function serializeForTransport(value, options = {}) {
  const path = options.path ?? "value";
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  return serializeValue(value, path, new WeakSet(), 0, maxDepth);
}

export function serializeObjectPayload(payload) {
  const serialized = serializeForTransport(payload, { path: "payload" });
  if (
    serialized === null ||
    Array.isArray(serialized) ||
    typeof serialized !== "object"
  ) {
    throw new BridgeError(
      ERROR_CODES.VALIDATION_ERROR,
      "Operation payload must be a plain object.",
    );
  }
  return serialized;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(serializeForTransport(value)));
}
