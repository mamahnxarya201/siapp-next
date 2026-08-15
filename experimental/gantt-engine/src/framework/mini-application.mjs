import { ActionDelegator } from "./action-delegator.mjs";
import { CommandBus } from "./command-bus.mjs";
import { Scheduler } from "./scheduler.mjs";
import { ViewHost, ViewRegistry } from "./view-host.mjs";

export class MiniApplication {
  constructor({
    root,
    scheduler = new Scheduler(),
    commandBus = new CommandBus(),
    viewRegistry = new ViewRegistry(),
    actionDelegator,
    onError = (error) => {
      throw error;
    },
  }) {
    this.scheduler = scheduler;
    this.commands = commandBus;
    this.views = viewRegistry;
    this.onError = onError;
    this.actions =
      actionDelegator ??
      new ActionDelegator({ root, commandBus: this.commands, onError });
    this._state = "created";
  }
  registerCommand(name, handler) {
    this.assertUsable();
    return this.commands.register(name, handler);
  }
  unregisterCommand(name, expected) {
    this.assertUsable();
    return this.commands.unregister(name, expected);
  }
  executeCommand(name, payload, context) {
    this.assertUsable();
    return this.commands.execute(name, payload, context);
  }
  registerView(name, root, render) {
    this.assertUsable();
    const host = new ViewHost({
      name,
      root,
      render,
      scheduler: this.scheduler,
      onError: this.onError,
    });
    this.views.register(name, host);
    return host;
  }
  unregisterView(name, expected) {
    this.assertUsable();
    return this.views.unregister(name, expected);
  }
  invalidateView(name, reason) {
    this.assertUsable();
    return this.views.invalidate(name, reason);
  }
  invalidateAllViews(reason) {
    this.assertUsable();
    this.views.invalidateAll(reason);
  }
  refreshView(name) {
    this.assertUsable();
    return this.views.refresh(name);
  }
  refreshAllViews() {
    this.assertUsable();
    return this.views.refreshAll();
  }
  scheduleAsync(operation) {
    this.assertUsable();
    return this.scheduler.scheduleAsync(operation);
  }
  start() {
    this.assertUsable();
    if (this._state === "running") return false;
    this.actions.start();
    try {
      this.views.start();
    } catch (error) {
      this.actions.stop();
      throw error;
    }
    this._state = "running";
    return true;
  }
  stop() {
    if (this._state !== "running") return false;
    this.actions.stop();
    this.views.stop();
    this.scheduler.cancelAll("The application was stopped.");
    this._state = "stopped";
    return true;
  }
  dispose() {
    if (this._state === "disposed") return false;
    if (this._state === "running") this.stop();
    else {
      this.actions.stop();
      this.scheduler.cancelAll("The application was disposed.");
    }
    this.views.dispose();
    this.commands.dispose();
    this._state = "disposed";
    return true;
  }
  assertUsable() {
    if (this._state === "disposed")
      throw new Error("The application has been disposed.");
  }
  get state() {
    return this._state;
  }
  get isRunning() {
    return this._state === "running";
  }
}
