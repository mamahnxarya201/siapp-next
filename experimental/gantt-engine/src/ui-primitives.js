const buttonStyles = `
:host { display: inline-block; }
button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-width: 0; border: 1px solid transparent; border-radius: 6px; color: var(--primary-foreground, #fff); background: var(--primary, #287984); cursor: pointer; font: 500 0.875rem/1 inherit; white-space: nowrap; transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease; }
button:hover:not(:disabled) { background: color-mix(in oklch, var(--primary, #287984) 88%, black); }
button:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary, #287984) 35%, transparent); }
button:disabled { cursor: not-allowed; opacity: .5; }
button[data-size="default"] { height: 36px; padding: 0 16px; }
button[data-size="sm"] { height: 32px; padding: 0 12px; font-size: .8125rem; }
button[data-size="lg"] { height: 40px; padding: 0 24px; }
button[data-size="icon"] { width: 36px; height: 36px; padding: 0; }
button[data-variant="destructive"] { color: #fff; background: var(--destructive, #ad4848); }
button[data-variant="outline"] { border-color: var(--border, #d5e2e6); color: var(--foreground, #183139); background: var(--card, #fff); }
button[data-variant="secondary"] { color: var(--foreground, #183139); background: var(--secondary, #e8f1f3); }
button[data-variant="ghost"] { color: var(--foreground, #183139); background: transparent; }
button[data-variant="link"] { height: auto; padding: 0; color: var(--primary, #287984); background: transparent; text-decoration: underline; text-underline-offset: 4px; }
`;

const textfieldStyles = `
:host { display: block; }
input { display: block; width: 100%; min-width: 0; height: 36px; padding: 4px 12px; border: 1px solid var(--input, #cbdcdf); border-radius: 6px; color: var(--foreground, #183139); background: transparent; font: 400 .875rem/1.25 inherit; outline: none; transition: border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease; }
input::placeholder { color: var(--muted-foreground, #60747c); }
input:focus-visible { border-color: var(--primary, #287984); box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary, #287984) 25%, transparent); }
input:disabled { cursor: not-allowed; opacity: .5; }
input[aria-invalid="true"] { border-color: var(--destructive, #ad4848); }
`;

class PmisButton extends HTMLElement {
  static observedAttributes = ["variant", "size", "disabled", "type", "name", "value"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>${buttonStyles}</style><button part="button"><slot></slot></button>`;
    this.button = this.shadowRoot.querySelector("button");
  }

  connectedCallback() { this.sync(); }
  attributeChangedCallback() { this.sync(); }

  sync() {
    if (!this.button) return;
    this.button.dataset.variant = this.getAttribute("variant") || "default";
    this.button.dataset.size = this.getAttribute("size") || "default";
    this.button.disabled = this.hasAttribute("disabled");
    this.button.type = this.getAttribute("type") || "button";
    for (const name of ["name", "value"]) {
      const value = this.getAttribute(name);
      if (value === null) this.button.removeAttribute(name);
      else this.button.setAttribute(name, value);
    }
  }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(value) { this.toggleAttribute("disabled", Boolean(value)); }
  focus() { this.button.focus(); }
}

class PmisTextfield extends HTMLElement {
  static observedAttributes = ["type", "name", "value", "placeholder", "disabled", "required", "invalid", "autocomplete"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>${textfieldStyles}</style><input part="input">`;
    this.input = this.shadowRoot.querySelector("input");
  }

  connectedCallback() { this.sync(); }
  attributeChangedCallback() { this.sync(); }

  sync() {
    if (!this.input) return;
    for (const name of ["type", "name", "value", "placeholder", "autocomplete"]) {
      const value = this.getAttribute(name);
      if (value === null) this.input.removeAttribute(name);
      else this.input.setAttribute(name, value);
    }
    this.input.disabled = this.hasAttribute("disabled");
    this.input.required = this.hasAttribute("required");
    if (this.hasAttribute("invalid")) this.input.setAttribute("aria-invalid", "true");
    else this.input.removeAttribute("aria-invalid");
  }

  get value() { return this.input.value; }
  set value(value) { this.input.value = value; }
  focus() { this.input.focus(); }
}

customElements.define("pmis-button", PmisButton);
customElements.define("pmis-textfield", PmisTextfield);

export { PmisButton, PmisTextfield };
