import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ActionDelegator,
  CommandBus,
  MiniApplication,
  Scheduler,
  ViewHost,
  ViewRegistry,
} from '../src/framework/index.mjs';

class FakeElement {
  constructor(tagName, { action, disabled = false, parent = null } = {}) {
    this.tagName = tagName.toUpperCase();
    this.dataset = action === undefined ? {} : { action };
    this.disabled = disabled;
    this.parentElement = parent;
  }
}

class FakeRoot extends FakeElement {
  constructor() {
    super('div');
    this.listeners = new Map();
    this.addCounts = new Map();
    this.removeCounts = new Map();
  }

  addEventListener(eventType, listener) {
    const listeners = this.listeners.get(eventType) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventType, listeners);
    this.addCounts.set(eventType, (this.addCounts.get(eventType) ?? 0) + 1);
  }

  removeEventListener(eventType, listener) {
    this.listeners.get(eventType)?.delete(listener);
    this.removeCounts.set(
      eventType,
      (this.removeCounts.get(eventType) ?? 0) + 1,
    );
  }

  dispatch(eventType, event) {
    for (const listener of this.listeners.get(eventType) ?? []) {
      listener(event);
    }
  }

  listenerCount(eventType) {
    return this.listeners.get(eventType)?.size ?? 0;
  }
}

class ManualScheduler {
  constructor() {
    this.microtasks = [];
  }

  scheduleMicrotask(callback) {
    const entry = {
      callback,
      cancelled: false,
    };
    this.microtasks.push(entry);

    return {
      cancel() {
        if (entry.cancelled) {
          return false;
        }
        entry.cancelled = true;
        return true;
      },
    };
  }

  cancelAll() {
    let cancelledCount = 0;
    for (const entry of this.microtasks) {
      if (!entry.cancelled) {
        entry.cancelled = true;
        cancelledCount += 1;
      }
    }
    return cancelledCount;
  }

  flushMicrotasks() {
    while (this.microtasks.length > 0) {
      const pending = this.microtasks.splice(0);
      for (const entry of pending) {
        if (!entry.cancelled) {
          entry.callback();
        }
      }
    }
  }

  get pendingMicrotaskCount() {
    return this.microtasks.filter((entry) => !entry.cancelled).length;
  }
}

function createEvent(target) {
  return {
    defaultPrevented: false,
    target,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

test('CommandBus explicitly registers, executes, and unregisters handlers', () => {
  const commandBus = new CommandBus();
  const executionContext = { source: 'test' };
  const objectHandler = {
    received: null,
    execute(payload, context) {
      this.received = { payload, context };
      return payload.value * 2;
    },
  };

  const unregister = commandBus.register('task.double', objectHandler);

  assert.equal(commandBus.has('task.double'), true);
  assert.equal(
    commandBus.execute('task.double', { value: 4 }, executionContext),
    8,
  );
  assert.deepEqual(objectHandler.received, {
    payload: { value: 4 },
    context: executionContext,
  });
  assert.throws(
    () => commandBus.register('task.double', () => {}),
    /already registered/,
  );

  assert.equal(unregister(), true);
  assert.equal(unregister(), false);
  assert.throws(
    () => commandBus.execute('task.double'),
    /not registered/,
  );
});

test('ActionDelegator uses one root listener per event type for buttons, forms, and controls', () => {
  const root = new FakeRoot();
  const commandBus = new CommandBus();
  const received = [];
  commandBus.register('task.select', (payload) => received.push(payload));
  commandBus.register('task.save', (payload) => received.push(payload));
  commandBus.register('timeline.set-scale', (payload) => received.push(payload));

  const delegator = new ActionDelegator({ root, commandBus });
  assert.equal(delegator.start(), true);
  assert.equal(delegator.start(), false);
  assert.equal(root.listenerCount('click'), 1);
  assert.equal(root.listenerCount('submit'), 1);
  assert.equal(root.listenerCount('change'), 1);
  assert.equal(root.addCounts.get('click'), 1);
  assert.equal(root.addCounts.get('submit'), 1);
  assert.equal(root.addCounts.get('change'), 1);

  const form = new FakeElement('form', {
    action: 'task.save',
    parent: root,
  });
  const button = new FakeElement('button', {
    action: 'task.select',
    parent: form,
  });
  const buttonLabel = new FakeElement('span', { parent: button });
  const clickEvent = createEvent(buttonLabel);
  root.dispatch('click', clickEvent);
  assert.equal(received.length, 1);
  assert.equal(received[0].action, 'task.select');

  const submitEvent = createEvent(form);
  root.dispatch('submit', submitEvent);
  const scaleInput = new FakeElement('input', {
    action: 'timeline.set-scale',
    parent: root,
  });
  const changeEvent = createEvent(scaleInput);
  root.dispatch('change', changeEvent);

  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(submitEvent.defaultPrevented, true);
  assert.deepEqual(
    received.map(({ action, eventType, source }) => ({
      action,
      eventType,
      source,
    })),
    [
      { action: 'task.select', eventType: 'click', source: button },
      { action: 'task.save', eventType: 'submit', source: form },
      { action: 'timeline.set-scale', eventType: 'change', source: scaleInput },
    ],
  );

  assert.equal(delegator.stop(), true);
  assert.equal(delegator.stop(), false);
  assert.equal(root.listenerCount('click'), 0);
  assert.equal(root.listenerCount('submit'), 0);
  assert.equal(root.listenerCount('change'), 0);
});

test('ActionDelegator ignores disabled buttons and reports unknown commands', () => {
  const root = new FakeRoot();
  const commandBus = new CommandBus();
  const errors = [];
  const delegator = new ActionDelegator({
    root,
    commandBus,
    onError(error, payload) {
      errors.push({ error, payload });
    },
  });
  delegator.start();

  const disabledButton = new FakeElement('button', {
    action: 'task.disabled',
    disabled: true,
    parent: root,
  });
  root.dispatch('click', createEvent(disabledButton));
  assert.equal(errors.length, 0);

  const unknownButton = new FakeElement('button', {
    action: 'task.unknown',
    parent: root,
  });
  root.dispatch('click', createEvent(unknownButton));
  assert.equal(errors.length, 1);
  assert.match(errors[0].error.message, /not registered/);
  assert.equal(errors[0].payload.action, 'task.unknown');
});

test('Scheduler supports cancellable microtasks and animation frames', async () => {
  const frameCallbacks = new Map();
  const cancelledFrameHandles = [];
  let nextFrameHandle = 1;
  const scheduler = new Scheduler({
    requestAnimationFrame(callback) {
      const handle = nextFrameHandle;
      nextFrameHandle += 1;
      frameCallbacks.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle) {
      cancelledFrameHandles.push(handle);
      frameCallbacks.delete(handle);
    },
  });

  let microtaskCalls = 0;
  const cancelledMicrotask = scheduler.scheduleMicrotask(() => {
    microtaskCalls += 1;
  });
  assert.equal(cancelledMicrotask.cancel(), true);

  scheduler.scheduleMicrotask(() => {
    microtaskCalls += 1;
  });
  await Promise.resolve();
  assert.equal(microtaskCalls, 1);

  let frameTimestamp = null;
  const frameJob = scheduler.scheduleAnimationFrame((timestamp) => {
    frameTimestamp = timestamp;
  });
  frameCallbacks.get(1)(123.5);
  assert.equal(frameTimestamp, 123.5);
  assert.equal(frameJob.isCompleted, true);

  const cancelledFrame = scheduler.scheduleAnimationFrame(() => {
    throw new Error('A cancelled frame must not run.');
  });
  assert.equal(cancelledFrame.cancel(), true);
  assert.deepEqual(cancelledFrameHandles, [2]);
  assert.equal(scheduler.activeJobCount, 0);
});

test('Scheduler supports cancellable delayed work', () => {
  const delayed = new Map();
  let nextHandle = 1;
  const scheduler = new Scheduler({
    setTimeout(callback, delay) {
      const handle = nextHandle++;
      delayed.set(handle, { callback, delay });
      return handle;
    },
    clearTimeout(handle) {
      delayed.delete(handle);
    },
    now: () => 123,
  });

  let timestamp = null;
  const job = scheduler.scheduleDelay((value) => { timestamp = value; }, 260);
  const [handle, entry] = [...delayed.entries()][0];
  assert.equal(entry.delay, 260);
  entry.callback();
  assert.equal(timestamp, 123);
  assert.equal(job.isCompleted, true);
  delayed.delete(handle);

  const cancelled = scheduler.scheduleDelay(() => {}, 50);
  assert.equal(cancelled.cancel(), true);
  assert.equal(delayed.size, 0);
});

test('Scheduler async jobs expose an AbortSignal and reject on cancellation', async () => {
  const scheduler = new Scheduler();
  const completedJob = scheduler.scheduleAsync(async (signal) => {
    assert.equal(signal.aborted, false);
    return 'finished';
  });
  assert.equal(await completedJob.promise, 'finished');
  assert.equal(completedJob.isCompleted, true);

  let operationStarted = false;
  const cancelledJob = scheduler.scheduleAsync(async (signal) => {
    operationStarted = true;
    await new Promise((resolve) => {
      signal.addEventListener('abort', resolve, { once: true });
    });
    return 'ignored after cancellation';
  });

  await Promise.resolve();
  assert.equal(operationStarted, true);
  assert.equal(cancelledJob.cancel('test cancellation'), true);
  await assert.rejects(cancelledJob.promise, {
    name: 'AbortError',
    message: 'test cancellation',
  });
  assert.equal(cancelledJob.signal.aborted, true);
  assert.equal(cancelledJob.isCancelled, true);
  assert.equal(scheduler.activeJobCount, 0);
});

test('ViewHost and ViewRegistry coalesce invalidations and permit explicit refresh', () => {
  const scheduler = new ManualScheduler();
  const registry = new ViewRegistry();
  const refreshes = [];
  const viewHost = new ViewHost({
    name: 'timeline',
    root: { id: 'timeline-root' },
    scheduler,
    render(refreshContext) {
      refreshes.push(refreshContext);
    },
  });
  registry.register('timeline', viewHost);
  registry.start();

  registry.invalidate('timeline', 'tasks-changed');
  registry.invalidate('timeline', 'selection-changed');
  assert.equal(scheduler.pendingMicrotaskCount, 1);
  assert.equal(refreshes.length, 0);

  scheduler.flushMicrotasks();
  assert.equal(refreshes.length, 1);
  assert.deepEqual(refreshes[0].reasons, [
    'start',
    'tasks-changed',
    'selection-changed',
  ]);
  assert.equal(refreshes[0].root.id, 'timeline-root');

  registry.invalidate('timeline', 'manual-refresh');
  assert.equal(registry.refresh('timeline'), true);
  assert.equal(refreshes.length, 2);
  assert.deepEqual(refreshes[1].reasons, ['manual-refresh']);
  assert.equal(scheduler.pendingMicrotaskCount, 0);
  assert.equal(registry.refresh('timeline'), false);

  registry.stop();
  registry.invalidate('timeline', 'while-stopped');
  assert.equal(scheduler.pendingMicrotaskCount, 0);
  registry.start();
  scheduler.flushMicrotasks();
  assert.deepEqual(refreshes[2].reasons, ['while-stopped', 'start']);
});

test('ViewHost reports a failed scheduled refresh without entering a retry loop', () => {
  const scheduler = new ManualScheduler();
  const errors = [];
  let renderAttempts = 0;
  const viewHost = new ViewHost({
    name: 'failing-view',
    root: {},
    scheduler,
    render() {
      renderAttempts += 1;
      throw new Error('render failed');
    },
    onError(error) {
      errors.push(error);
    },
  });

  viewHost.start();
  scheduler.flushMicrotasks();

  assert.equal(renderAttempts, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /render failed/);
  assert.equal(viewHost.isDirty, true);
  assert.equal(scheduler.pendingMicrotaskCount, 0);
});

test('MiniApplication composes command, delegation, view, and lifecycle services', () => {
  const root = new FakeRoot();
  const scheduler = new ManualScheduler();
  const application = new MiniApplication({ root, scheduler });
  const renderReasons = [];
  let selectionCount = 0;

  application.registerView('timeline', { id: 'timeline' }, ({ reasons }) => {
    renderReasons.push(reasons);
  });
  application.registerCommand('task.select', () => {
    selectionCount += 1;
    application.invalidateView('timeline', 'selection-command');
  });

  assert.equal(application.start(), true);
  assert.equal(application.start(), false);
  assert.equal(application.state, 'running');
  assert.equal(root.listenerCount('click'), 1);
  assert.equal(root.listenerCount('submit'), 1);
  scheduler.flushMicrotasks();
  assert.deepEqual(renderReasons, [['start']]);

  const button = new FakeElement('button', {
    action: 'task.select',
    parent: root,
  });
  root.dispatch('click', createEvent(button));
  assert.equal(selectionCount, 1);
  assert.equal(scheduler.pendingMicrotaskCount, 1);
  scheduler.flushMicrotasks();
  assert.deepEqual(renderReasons, [['start'], ['selection-command']]);

  assert.equal(application.stop(), true);
  assert.equal(application.stop(), false);
  assert.equal(application.state, 'stopped');
  assert.equal(root.listenerCount('click'), 0);
  assert.equal(root.listenerCount('submit'), 0);
  root.dispatch('click', createEvent(button));
  assert.equal(selectionCount, 1);

  assert.equal(application.dispose(), true);
  assert.equal(application.dispose(), false);
  assert.equal(application.state, 'disposed');
  assert.throws(() => application.start(), /disposed/);
});

test('MiniApplication rolls back listeners and started views when startup fails', () => {
  class FailingSecondSchedule extends ManualScheduler {
    constructor() {
      super();
      this.scheduleCount = 0;
    }

    scheduleMicrotask(callback) {
      this.scheduleCount += 1;
      if (this.scheduleCount === 2) {
        throw new Error('scheduler unavailable');
      }
      return super.scheduleMicrotask(callback);
    }
  }

  const root = new FakeRoot();
  const scheduler = new FailingSecondSchedule();
  const application = new MiniApplication({ root, scheduler });
  const firstView = application.registerView('first', {}, () => {});
  const secondView = application.registerView('second', {}, () => {});

  assert.throws(() => application.start(), /scheduler unavailable/);
  assert.equal(application.state, 'created');
  assert.equal(application.views.isActive, false);
  assert.equal(firstView.isActive, false);
  assert.equal(secondView.isActive, false);
  assert.equal(root.listenerCount('click'), 0);
  assert.equal(root.listenerCount('submit'), 0);
  assert.equal(scheduler.pendingMicrotaskCount, 0);
});
