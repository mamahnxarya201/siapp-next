function nameOf(value) {
  if (typeof value !== "string" || value.trim() === "")
    throw new TypeError("A view name must be a non-empty string.");
  return value.trim();
}
const throwError = (error) => {
  throw error;
};

export class ViewHost {
  constructor({ name, root, render, scheduler, onError = throwError }) {
    if (typeof render !== "function")
      throw new TypeError("A view host requires a render function.");
    if (!scheduler || typeof scheduler.scheduleMicrotask !== "function")
      throw new TypeError("A view host requires a scheduler.");
    this.name = nameOf(name);
    this.root = root;
    this.render = render;
    this.scheduler = scheduler;
    this.onError = onError;
    this.active = false;
    this.disposed = false;
    this.dirty = false;
    this.refreshing = false;
    this.scheduled = null;
    this.reasons = new Set();
  }
  start() {
    this.assertUsable();
    if (this.active) return false;
    this.active = true;
    try {
      this.invalidate("start");
    } catch (error) {
      this.active = false;
      this.cancelScheduled();
      throw error;
    }
    return true;
  }
  stop() {
    if (!this.active) return false;
    this.active = false;
    this.cancelScheduled();
    return true;
  }
  invalidate(reason = "invalidated") {
    this.assertUsable();
    this.dirty = true;
    this.reasons.add(String(reason));
    if (this.active && !this.refreshing) this.scheduleRefresh();
    return this;
  }
  refresh() {
    this.assertUsable();
    if (!this.active || !this.dirty) return false;
    this.cancelScheduled();
    const reasons = [...this.reasons];
    this.reasons.clear();
    this.dirty = false;
    this.refreshing = true;
    try {
      this.render({ host: this, name: this.name, reasons, root: this.root });
    } catch (error) {
      this.dirty = true;
      this.reasons.add("refresh-retry");
      throw error;
    } finally {
      this.refreshing = false;
    }
    return true;
  }
  dispose() {
    if (this.disposed) return false;
    this.stop();
    this.reasons.clear();
    this.dirty = false;
    this.disposed = true;
    return true;
  }
  scheduleRefresh() {
    if (this.scheduled) return;
    this.scheduled = this.scheduler.scheduleMicrotask(() => {
      this.scheduled = null;
      try {
        this.refresh();
      } catch (error) {
        this.onError(error, this);
      }
    });
  }
  cancelScheduled() {
    if (!this.scheduled) return;
    this.scheduled.cancel();
    this.scheduled = null;
  }
  assertUsable() {
    if (this.disposed)
      throw new Error(`View "${this.name}" has been disposed.`);
  }
  get isActive() {
    return this.active;
  }
  get isDirty() {
    return this.dirty;
  }
  get isDisposed() {
    return this.disposed;
  }
}

export class ViewRegistry {
  constructor() {
    this.views = new Map();
    this.active = false;
    this.disposed = false;
  }
  register(name, host) {
    this.assertUsable();
    const normalized = nameOf(name);
    if (!host || typeof host.invalidate !== "function")
      throw new TypeError(
        "ViewRegistry requires a ViewHost-compatible object.",
      );
    if (host.name !== normalized)
      throw new Error(
        `View registry name "${normalized}" does not match host name "${host.name}".`,
      );
    if (this.views.has(normalized))
      throw new Error(`View "${normalized}" is already registered.`);
    this.views.set(normalized, host);
    if (this.active) host.start();
    return () => this.unregister(normalized, host);
  }
  unregister(name, expected) {
    this.assertUsable();
    const normalized = nameOf(name);
    const host = this.views.get(normalized);
    if (!host || (expected !== undefined && host !== expected)) return false;
    host.stop();
    this.views.delete(normalized);
    return true;
  }
  get(name) {
    this.assertUsable();
    return this.views.get(nameOf(name)) ?? null;
  }
  start() {
    this.assertUsable();
    if (this.active) return false;
    this.active = true;
    const started = [];
    try {
      for (const host of this.views.values()) {
        host.start();
        started.push(host);
      }
    } catch (error) {
      for (const host of started) host.stop();
      this.active = false;
      throw error;
    }
    return true;
  }
  stop() {
    if (!this.active) return false;
    this.active = false;
    for (const host of this.views.values()) host.stop();
    return true;
  }
  invalidate(name, reason) {
    const host = this.require(name);
    host.invalidate(reason);
    return host;
  }
  invalidateAll(reason) {
    this.assertUsable();
    for (const host of this.views.values()) host.invalidate(reason);
  }
  refresh(name) {
    return this.require(name).refresh();
  }
  refreshAll() {
    this.assertUsable();
    let count = 0;
    for (const host of this.views.values()) if (host.refresh()) count += 1;
    return count;
  }
  dispose() {
    if (this.disposed) return false;
    this.stop();
    for (const host of this.views.values()) host.dispose();
    this.views.clear();
    this.disposed = true;
    return true;
  }
  require(name) {
    this.assertUsable();
    const normalized = nameOf(name);
    const host = this.views.get(normalized);
    if (!host) throw new Error(`View "${normalized}" is not registered.`);
    return host;
  }
  assertUsable() {
    if (this.disposed) throw new Error("The view registry has been disposed.");
  }
  get size() {
    return this.views.size;
  }
  get isActive() {
    return this.active;
  }
}
