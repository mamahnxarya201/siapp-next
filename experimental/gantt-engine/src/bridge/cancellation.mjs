import { BridgeError, ERROR_CODES } from "./errors.mjs";

function isAbortSignal(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.aborted === "boolean" &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}

function abortReason(code, message, details = null) {
  return new BridgeError(code, message, { details });
}

export function createOperationCancellation(externalSignal, timeoutMs) {
  if (externalSignal !== undefined && !isAbortSignal(externalSignal)) {
    throw new BridgeError(
      ERROR_CODES.VALIDATION_ERROR,
      "options.signal must be an AbortSignal.",
    );
  }

  const controller = new AbortController();
  let timeoutId = null;

  const cancelFromCaller = () => {
    if (!controller.signal.aborted) {
      controller.abort(
        abortReason(
          ERROR_CODES.CANCELLED,
          "The operation was cancelled by its caller.",
        ),
      );
    }
  };

  if (externalSignal?.aborted) {
    cancelFromCaller();
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", cancelFromCaller, { once: true });
  }

  if (timeoutMs !== null) {
    timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort(
          abortReason(
            ERROR_CODES.TIMEOUT,
            `The operation exceeded its ${timeoutMs} ms timeout.`,
            { timeoutMs },
          ),
        );
      }
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      externalSignal?.removeEventListener("abort", cancelFromCaller);
    },
  };
}

export function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : abortReason(ERROR_CODES.CANCELLED, "The operation was cancelled.");
  }
}

export function raceWithSignal(operationPromise, signal) {
  const operation = Promise.resolve(operationPromise);

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };

    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    if (signal?.aborted) {
      operation.catch(() => {});
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}
