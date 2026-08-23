// Application-facing bridge surface. Concrete transports intentionally live in
// transports.mjs so UI/view/renderer modules have no reason to import them.
export { BridgeError, ERROR_CODES } from "./errors.mjs";
export { Gateway, createBridge } from "./gateway.mjs";
export { BRIDGE_PROTOCOL_VERSION } from "./protocol.mjs";
