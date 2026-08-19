import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

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
  });
  fixture.document.body.append(shell);

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

  const controls = [...shell.querySelectorAll('[data-route-id]')];
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
  assert.equal(shell.querySelector(".directive-shell-time"), null, "global shell time must stay in route-native chronometers");
  assert.equal(shell.querySelector(".directive-route-heading")?.textContent, "Mission");
  assert.equal(shell.querySelector(".directive-route-path")?.textContent, "Mission / Objectives & Outcomes");
  assert.equal(shell.querySelector(".directive-route-body")?.dataset.routeView, "mission");
  assert.equal(shell.querySelector(".directive-route-bar")?.getAttribute("role"), "tablist");

  const close = shell.querySelector('[data-shell-action="close"]');
  close.focus();
  const reverseWrap = dispatchKeyboard(fixture.window, close, "Tab", { shiftKey: true });
  assert.equal(reverseWrap.defaultPrevented, true);
  assert.equal(fixture.document.activeElement, controls[1], "Shift+Tab from the first modal control wraps to the last");
  controls[1].focus();
  const forwardWrap = dispatchKeyboard(fixture.window, controls[1], "Tab");
  assert.equal(forwardWrap.defaultPrevented, true);
  assert.equal(fixture.document.activeElement, close, "Tab from the last modal control wraps to the first");

  const bubbledKeys = [];
  shell.addEventListener("keydown", (event) => bubbledKeys.push(event.key));
  const arrowRight = dispatchKeyboard(fixture.window, controls[1], "ArrowRight");
  assert.equal(arrowRight.defaultPrevented, true);
  assert.deepEqual(bubbledKeys, ["ArrowRight"]);
  assert.equal(fixture.document.activeElement, controls[2]);
  assert.deepEqual(selected, ["people"], "arrow navigation focuses and activates the next primary route");
  assert.equal(shell.dataset.activeRoute, "people");
  assert.equal(shell.querySelector(".directive-route-heading")?.textContent, "People");
  assert.equal(shell.querySelector(".directive-route-path")?.textContent, "People / Roster & Contacts");

  const enter = dispatchKeyboard(fixture.window, controls[2], "Enter");
  assert.equal(enter.defaultPrevented, true);
  assert.deepEqual(selected, ["people", "people"]);
  assert.equal(shell.dataset.activeRoute, "people");

  dispatchKeyboard(fixture.window, controls[2], "ArrowLeft");
  assert.equal(fixture.document.activeElement, controls[1]);
  assert.deepEqual(selected, ["people", "people", "mission"]);
  assert.equal(shell.dataset.activeRoute, "mission");
  dispatchKeyboard(fixture.window, controls[1], " ");
  assert.deepEqual(selected, ["people", "people", "mission", "mission"]);

  setShellRoute(shell, "settings");
  assert.equal(shell.dataset.activeRoute, "settings");
  assert.equal(controls[4].getAttribute("aria-selected"), "true");
  assert.equal(controls[4].getAttribute("aria-current"), "page");
  assert.equal(controls[1].getAttribute("aria-current"), null);

  controls[4].focus();
  const selectedBeforeEndBoundary = [...selected];
  const endAtSettings = dispatchKeyboard(fixture.window, controls[4], "End");
  assert.equal(endAtSettings.defaultPrevented, false);
  assert.deepEqual(selected, selectedBeforeEndBoundary, "End on Settings must not reactivate Settings");
  assert.equal(shell.dataset.activeRoute, "settings");

  setShellRoute(shell, "campaign");
  controls[0].focus();
  const selectedBeforeHomeBoundary = [...selected];
  const homeAtCampaign = dispatchKeyboard(fixture.window, controls[0], "Home");
  assert.equal(homeAtCampaign.defaultPrevented, false);
  assert.deepEqual(selected, selectedBeforeHomeBoundary, "Home on Campaign must not reactivate Campaign");
  assert.equal(shell.dataset.activeRoute, "campaign");

  shell.querySelector('[data-shell-action="close"]').click();
  const escape = dispatchKeyboard(fixture.window, controls[4], "Escape");
  assert.equal(escape.defaultPrevented, true);
  assert.equal(bubbledKeys.at(-1), "Escape");
  assert.equal(closed, 2);
  fixture.window.close();
});

function dispatchKeyboard(window, target, key, options = {}) {
  const event = new window.KeyboardEvent("keydown", {
    key,
    shiftKey: options.shiftKey === true,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function installDomFixture() {
  const window = new Window();
  const { document } = window;
  globalThis.document = document;
  return { document, window };
}
