import { createDirectiveView } from "./app.js";

export { renderMissionView } from "./views/mission.js";
export { renderPeopleView } from "./views/people.js";
export { renderSettingsView } from "./views/settings.js";
export { renderShipView } from "./views/ship.js";

export function createDirectiveFocusController(sonder, root = document) {
  let returnTarget = null;
  return {
    open() {
      returnTarget = root.activeElement;
      const opened = sonder.openView("directive");
      if (!opened) return false;
      schedule(root, () => root.querySelector(".directive-close")?.focus({ preventScroll: true }));
      return true;
    },
    close() {
      sonder.closeView();
      schedule(root, () => {
        const target = returnTarget?.isConnected
          ? returnTarget
          : root.querySelector('[data-ext-button="directive-launch"]');
        target?.focus?.({ preventScroll: true });
      });
    }
  };
}

export function register(sonder) {
  const focus = createDirectiveFocusController(sonder);
  sonder.registerView(createDirectiveView(sonder, { onClose: () => focus.close() }));
  sonder.registerTopBarButton({
    id: "directive-launch",
    icon: "⌁",
    title: "Directive",
    onClick: () => focus.open()
  });
  sonder.registerSettingsSection({
    id: "directive-about",
    label: "Campaign authority",
    render(container) {
      container.replaceChildren(node("p", "directive-settings-copy",
        "Directive uses Sonder's configured models and committed story lineage. Player dialogue remains player-authored."));
    }
  });
  sonder.registerStepRenderer("ext:directive:settlement", (content, root) => {
    const applied = Array.isArray(content?.claims) ? content.claims.length : 0;
    root.replaceChildren(node("div", "directive-step", applied
      ? `${applied} authored campaign effect${applied === 1 ? "" : "s"} proposed.`
      : "No authored campaign effects proposed."));
  });
}

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function schedule(root, callback) {
  const frame = root?.defaultView?.requestAnimationFrame || globalThis.requestAnimationFrame;
  if (frame) frame.call(root?.defaultView || globalThis, callback);
  else queueMicrotask(callback);
}
