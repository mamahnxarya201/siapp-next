// Composition-root-only exports. Construct one transport at application startup
// and inject it into Gateway; never import this module from a view or renderer.
export { FetchTransport } from "./fetch-transport.mjs";
export { InMemoryTransport } from "./in-memory-transport.mjs";
