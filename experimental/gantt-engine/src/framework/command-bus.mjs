function commandName(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('A command name must be a non-empty string.');
  return value.trim();
}

function registrationFor(handler) {
  if (typeof handler === 'function') return { original:handler, execute:handler };
  if (handler && typeof handler.execute === 'function') {
    return { original:handler, execute:(payload, context) => handler.execute(payload, context) };
  }
  throw new TypeError('A command handler must be a function or an object with an execute method.');
}

export class CommandBus {
  constructor() { this.registrations = new Map(); this.disposed = false; }
  register(name, handler) {
    this.assertUsable(); const normalized = commandName(name);
    if (this.registrations.has(normalized)) throw new Error(`Command "${normalized}" is already registered.`);
    const registration = registrationFor(handler); this.registrations.set(normalized, registration);
    return () => this.unregister(normalized, registration.original);
  }
  unregister(name, expected) {
    this.assertUsable(); const normalized = commandName(name); const current = this.registrations.get(normalized);
    if (!current || (expected !== undefined && current.original !== expected)) return false;
    this.registrations.delete(normalized); return true;
  }
  has(name) { this.assertUsable(); return this.registrations.has(commandName(name)); }
  execute(name, payload, context) {
    this.assertUsable(); const normalized = commandName(name); const current = this.registrations.get(normalized);
    if (!current) throw new Error(`Command "${normalized}" is not registered.`);
    return current.execute(payload, context);
  }
  clear() { this.assertUsable(); this.registrations.clear(); }
  dispose() { if (this.disposed) return false; this.registrations.clear(); this.disposed = true; return true; }
  get size() { return this.registrations.size; }
  get isDisposed() { return this.disposed; }
  assertUsable() { if (this.disposed) throw new Error('The command bus has been disposed.'); }
}
