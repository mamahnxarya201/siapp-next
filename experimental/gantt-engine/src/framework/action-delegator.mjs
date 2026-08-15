function actionName(element) {
  const value = element?.dataset?.action ?? element?.getAttribute?.('data-action');
  return typeof value === 'string' ? value.trim() : '';
}

function closestAction(start, root, tags) {
  let element = start;
  while (element) {
    if (tags.includes(String(element.tagName).toUpperCase()) && actionName(element)) return element;
    if (element === root) break;
    element = element.parentElement;
  }
  return null;
}

export class ActionDelegator {
  constructor({ root, commandBus, onError = (error) => { throw error; } }) {
    if (!root || typeof root.addEventListener !== 'function' || typeof root.removeEventListener !== 'function') throw new TypeError('ActionDelegator requires an event-listener root.');
    if (!commandBus || typeof commandBus.execute !== 'function') throw new TypeError('ActionDelegator requires a command bus.');
    this.root = root; this.commandBus = commandBus; this.onError = onError; this.started = false;
    this.listeners = {
      click:(event) => this.handle(event, 'click', ['BUTTON']),
      submit:(event) => this.handle(event, 'submit', ['FORM']),
      change:(event) => this.handle(event, 'change', ['INPUT','SELECT','TEXTAREA']),
    };
  }
  start() {
    if (this.started) return false;
    for (const [type, listener] of Object.entries(this.listeners)) this.root.addEventListener(type, listener);
    this.started = true; return true;
  }
  stop() {
    if (!this.started) return false;
    for (const [type, listener] of Object.entries(this.listeners)) this.root.removeEventListener(type, listener);
    this.started = false; return true;
  }
  get isStarted() { return this.started; }
  handle(event, eventType, tags) {
    if (event.defaultPrevented) return;
    const source = closestAction(event.target, this.root, tags);
    if (!source || source.disabled) return;
    event.preventDefault?.();
    const payload = { action:actionName(source), event, eventType, root:this.root, source };
    try {
      const result = this.commandBus.execute(payload.action, payload);
      if (result && typeof result.then === 'function') result.catch((error) => this.onError(error, payload));
    } catch (error) { this.onError(error, payload); }
  }
}
