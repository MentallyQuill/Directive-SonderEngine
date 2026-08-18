import assert from "node:assert/strict";
import test from "node:test";

import { DIRECTIVE_ROUTES } from "../../ui/routes.js";
import { createDirectiveShell, setShellRoute } from "../../ui/shell.js";

test("Directive shell preserves the five-route LCARS navigation and keyboard contract", () => {
  const fixture = installDomFixture();
  const selected = [];
  let closed = 0;
  const shell = createDirectiveShell({
    activeRouteId: "mission",
    onSelectRoute: (routeId) => selected.push(routeId),
    onClose: () => { closed += 1; },
    time: { clock_display: "2380-04-17 16:42", stardate: 57300.4 },
  });

  assert.match(shell.className, /\bdirective-expanded-shell\b/);
  assert.equal(shell.dataset.activeRoute, "mission");
  assert.equal(shell.getAttribute("role"), "dialog");
  assert.equal(shell.getAttribute("aria-modal"), "true");
  assert.deepEqual(
    DIRECTIVE_ROUTES.map(({ id, label, glyphId }) => [id, label, glyphId]),
    [
      ["campaign", "Campaign", "route-campaign"],
      ["mission", "Mission", "route-mission"],
      ["people", "People", "route-crew"],
      ["ship", "Ship", "route-ship"],
      ["settings", "Settings", "route-settings"],
    ],
  );

  const controls = shell.querySelectorAll('[data-route-id]');
  assert.deepEqual(controls.map((control) => control.textContent), ["Campaign", "Mission", "People", "Ship", "Settings"]);
  assert.deepEqual(controls.map((control) => control.dataset.glyph), ["route-campaign", "route-mission", "route-crew", "route-ship", "route-settings"]);
  assert.ok(controls.every((control) => control.getAttribute("role") === "tab"));
  assert.equal(controls[1].getAttribute("aria-selected"), "true");
  assert.equal(controls[1].getAttribute("aria-current"), "page");
  assert.equal(controls[1].tabIndex, 0);
  assert.equal(controls[0].tabIndex, -1);

  assert.equal(shell.querySelectorAll(".directive-lcars-rail-segment").length, 5);
  assert.equal(shell.querySelector(".directive-workspace")?.tagName, "MAIN");
  assert.equal(shell.querySelector(".directive-topbar")?.tagName, "HEADER");
  assert.equal(shell.querySelector(".directive-route-heading")?.textContent, "Mission");
  assert.equal(shell.querySelector(".directive-route-path")?.textContent, "Mission / Objectives & Outcomes");
  assert.equal(shell.querySelector(".directive-route-body")?.dataset.routeView, "mission");
  assert.equal(shell.querySelector(".directive-route-bar")?.getAttribute("role"), "tablist");

  controls[1].dispatch("keydown", keyboardEvent("ArrowRight"));
  assert.equal(fixture.document.activeElement, controls[2]);
  assert.equal(selected.length, 0, "arrow navigation moves focus without changing the active route");
  controls[2].dispatch("keydown", keyboardEvent("Enter"));
  assert.deepEqual(selected, ["people"]);
  assert.equal(shell.dataset.activeRoute, "people");
  assert.equal(shell.querySelector(".directive-route-heading")?.textContent, "People");
  assert.equal(shell.querySelector(".directive-route-path")?.textContent, "People / Roster & Contacts");

  controls[2].dispatch("keydown", keyboardEvent("ArrowLeft"));
  assert.equal(fixture.document.activeElement, controls[1]);
  controls[1].dispatch("keydown", keyboardEvent(" "));
  assert.deepEqual(selected, ["people", "mission"]);

  setShellRoute(shell, "settings");
  assert.equal(shell.dataset.activeRoute, "settings");
  assert.equal(controls[4].getAttribute("aria-selected"), "true");
  assert.equal(controls[4].getAttribute("aria-current"), "page");
  assert.equal(controls[1].getAttribute("aria-current"), null);

  shell.querySelector('[data-shell-action="close"]').click();
  shell.dispatch("keydown", keyboardEvent("Escape"));
  assert.equal(closed, 2);
});

function keyboardEvent(key) {
  return {
    key,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {},
  };
}

function installDomFixture() {
  const document = new DocumentFixture();
  globalThis.document = document;
  return { document };
}

class DocumentFixture {
  constructor() { this.activeElement = null; }
  createElement(tagName) { return new ElementFixture(tagName, this); }
  createTextNode(text) { return new TextFixture(text); }
}

class TextFixture {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
    this.parentNode = null;
  }
}

class ElementFixture {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.parentNode = null;
    this.tabIndex = 0;
  }
  get textContent() { return this.children.map((child) => child.textContent).join(""); }
  set textContent(value) {
    this.children = value === "" ? [] : [Object.assign(new TextFixture(value), { parentNode: this })];
  }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatch(type, event = {}) {
    event.target ||= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  click() { this.dispatch("click", { stopPropagation() {} }); }
  focus() { this.ownerDocument.activeElement = this; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children || []) {
        if (matchesSelector(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

function matchesSelector(node, selector) {
  if (!(node instanceof ElementFixture)) return false;
  if (selector === "[data-route-id]") return Boolean(node.dataset.routeId);
  if (selector === '[data-shell-action="close"]') return node.dataset.shellAction === "close";
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}
