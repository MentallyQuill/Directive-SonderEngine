import assert from "node:assert/strict";
import test from "node:test";

import * as directiveUi from "../../ui/index.js";

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
