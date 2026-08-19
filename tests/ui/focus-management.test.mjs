import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import * as directiveUi from "../../ui/index.js";
import { createDirectiveView } from "../../ui/app.js";

test("Directive registers a textless launcher for the exact ship SVG mask", () => {
  const window = new Window();
  globalThis.document = window.document;
  let registered = null;
  const sonder = {
    registerView() {},
    registerTopBarButton(config) { registered = config; },
    registerSettingsSection() {},
    registerStepRenderer() {},
  };

  directiveUi.register(sonder);

  assert.equal(registered?.id, "directive-launch");
  assert.equal(registered?.icon, " ");
  assert.equal(registered?.title, "Directive");
  window.close();
});

test("active-story focus enters Directive before a delayed projection resolves", async () => {
  const window = new Window();
  globalThis.document = window.document;
  const launcher = window.document.createElement("button");
  launcher.dataset.extButton = "directive-launch";
  const container = window.document.createElement("div");
  window.document.body.append(launcher, container);
  launcher.focus();
  let resolveProjection;
  const projection = new Promise((resolve) => { resolveProjection = resolve; });
  let rendering;
  const sonder = {
    state: () => ({ chatId: 27 }),
    api: () => projection,
    openView() {
      rendering = createDirectiveView(sonder).render(container);
      return true;
    },
    closeView() {},
  };

  const focus = directiveUi.createDirectiveFocusController(sonder, window.document);
  focus.open();
  await waitFor(
    () => window.document.activeElement?.classList.contains("directive-close-action"),
    window,
  );

  assert.equal(window.document.activeElement?.classList.contains("directive-close-action"), true);
  resolveProjection({});
  await rendering;
  window.close();
});

async function waitFor(predicate, window, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
}

test("opening Directive moves focus from the launcher into the view", () => {
  const launcher = focusable();
  const closeButton = focusable();
  const root = focusRoot(launcher, closeButton);
  let opened = null;
  const sonder = {
    openView(id) {
      opened = id;
      return true;
    },
  };

  const focus = directiveUi.createDirectiveFocusController(sonder, root);
  focus.open();

  assert.equal(opened, "directive");
  assert.equal(closeButton.focused, true);
});

test("closing Directive restores focus to the launcher", () => {
  const launcher = focusable();
  const closeButton = focusable();
  const root = focusRoot(launcher, closeButton);
  let closed = false;
  const sonder = {
    openView() {
      return true;
    },
    closeView() {
      closed = true;
    },
  };

  const focus = directiveUi.createDirectiveFocusController(sonder, root);
  focus.open();
  focus.close();

  assert.equal(closed, true);
  assert.equal(launcher.focused, true);
});

test("closing Directive finds the current launcher after Sonder replaces it", () => {
  const launcher = focusable();
  const replacement = focusable();
  const root = focusRoot(launcher, focusable(), replacement);
  const sonder = {
    openView() {
      return true;
    },
    closeView() {},
  };

  const focus = directiveUi.createDirectiveFocusController(sonder, root);
  focus.open();
  launcher.isConnected = false;
  focus.close();

  assert.equal(replacement.focused, true);
});

function focusable() {
  return {
    focused: false,
    isConnected: true,
    focus() { this.focused = true; },
  };
}

function focusRoot(activeElement, closeButton, replacementLauncher = null) {
  return {
    activeElement,
    defaultView: { requestAnimationFrame(callback) { callback(); } },
    querySelector(selector) {
      if (selector === ".directive-close-action") return closeButton;
      if (selector === '[data-ext-button="directive-launch"]') return replacementLauncher;
      return null;
    },
  };
}
