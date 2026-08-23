import { throwIfAborted } from "./cancellation.mjs";
import { BridgeError, ERROR_CODES } from "./errors.mjs";
import { BRIDGE_PROTOCOL_VERSION } from "./protocol.mjs";

function isPlainObject(value) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeHeaders(headers, sourceName) {
  if (headers === undefined || headers === null) {
    return {};
  }
  if (!isPlainObject(headers)) {
    throw new BridgeError(
      ERROR_CODES.INTERNAL_ERROR,
      `${sourceName} must return a plain object of HTTP headers.`,
    );
  }

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => {
      if (typeof value !== "string") {
        throw new BridgeError(
          ERROR_CODES.INTERNAL_ERROR,
          `${sourceName} header values must be strings.`,
          { details: { header: name } },
        );
      }
      return [name, value];
    }),
  );
}

function setRequiredHeader(headers, name, value) {
  for (const existingName of Object.keys(headers)) {
    if (existingName.toLowerCase() === name.toLowerCase()) {
      delete headers[existingName];
    }
  }
  headers[name] = value;
}

function httpError(status, statusText, retryAfter) {
  let code = ERROR_CODES.HTTP_ERROR;
  let retryable = false;

  if (status === 400 || status === 422) code = ERROR_CODES.VALIDATION_ERROR;
  else if (status === 401) code = ERROR_CODES.AUTH_REQUIRED;
  else if (status === 403) code = ERROR_CODES.FORBIDDEN;
  else if (status === 404) code = ERROR_CODES.NOT_FOUND;
  else if (status === 408) {
    code = ERROR_CODES.TIMEOUT;
    retryable = true;
  } else if (status === 409) code = ERROR_CODES.CONFLICT;
  else if (status === 429) {
    code = ERROR_CODES.RATE_LIMITED;
    retryable = true;
  } else if (status === 502 || status === 503 || status === 504) {
    code = ERROR_CODES.UNAVAILABLE;
    retryable = true;
  } else if (status >= 500) {
    code = ERROR_CODES.HTTP_ERROR;
    retryable = true;
  }

  return new BridgeError(
    code,
    `HTTP ${status}${statusText ? ` ${statusText}` : ""}.`,
    {
      retryable,
      details: {
        httpStatus: status,
        retryAfter: retryAfter ?? null,
      },
    },
  );
}

export class FetchTransport {
  constructor(options = {}) {
    if (typeof options.endpoint !== "string" || options.endpoint.length === 0) {
      throw new TypeError("FetchTransport requires a non-empty endpoint URL.");
    }

    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new TypeError("FetchTransport requires a fetch implementation.");
    }

    this.name = "fetch";
    this.endpoint = options.endpoint;
    this.fetchImpl = fetchImpl;
    this.credentials = options.credentials ?? "same-origin";
    this.headers = normalizeHeaders(options.headers, "FetchTransport headers");
    this.headerProvider = options.headerProvider ?? null;

    if (
      this.headerProvider !== null &&
      typeof this.headerProvider !== "function"
    ) {
      throw new TypeError("headerProvider must be a function when supplied.");
    }
  }

  async send(request, context = {}) {
    const { signal } = context;
    throwIfAborted(signal);

    const providedHeaders = this.headerProvider
      ? normalizeHeaders(await this.headerProvider(request), "headerProvider")
      : {};
    const headers = {
      ...this.headers,
      ...providedHeaders,
    };
    setRequiredHeader(headers, "Accept", "application/json");
    setRequiredHeader(
      headers,
      "Content-Type",
      "application/json; charset=utf-8",
    );
    setRequiredHeader(
      headers,
      "X-PMIS-Bridge-Version",
      BRIDGE_PROTOCOL_VERSION,
    );
    if (request.meta.idempotencyKey) {
      setRequiredHeader(
        headers,
        "Idempotency-Key",
        request.meta.idempotencyKey,
      );
    }

    let response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        credentials: this.credentials,
        body: JSON.stringify(request),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throwIfAborted(signal);
      }
      throw new BridgeError(
        ERROR_CODES.NETWORK_ERROR,
        "The bridge endpoint could not be reached.",
        { retryable: true, cause: error },
      );
    }

    let bodyText;
    try {
      bodyText = await response.text();
    } catch (error) {
      throw new BridgeError(
        ERROR_CODES.NETWORK_ERROR,
        "The bridge response could not be read.",
        { retryable: true, cause: error },
      );
    }

    const retryAfter = response.headers?.get?.("retry-after") ?? null;
    if (bodyText.length === 0) {
      if (!response.ok) {
        throw httpError(response.status, response.statusText, retryAfter);
      }
      throw new BridgeError(
        ERROR_CODES.PROTOCOL_ERROR,
        "The bridge endpoint returned an empty response.",
      );
    }

    const contentType = response.headers?.get?.("content-type") ?? "";
    if (!/(?:application\/json|[^;]+\+json)(?:;|$)/i.test(contentType)) {
      throw new BridgeError(
        ERROR_CODES.PROTOCOL_ERROR,
        "The bridge endpoint response is not JSON content.",
        {
          details: {
            contentType: contentType || null,
            httpStatus: response.status,
          },
        },
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch (error) {
      throw new BridgeError(
        ERROR_CODES.PROTOCOL_ERROR,
        "The bridge endpoint returned invalid JSON.",
        {
          details: { httpStatus: response.status },
          cause: error,
        },
      );
    }

    if (!response.ok) {
      if (parsed?.ok === false && isPlainObject(parsed.meta)) {
        return {
          ...parsed,
          meta: { ...parsed.meta, httpStatus: response.status },
        };
      }
      throw httpError(response.status, response.statusText, retryAfter);
    }

    return parsed;
  }
}
