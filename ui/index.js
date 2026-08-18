import { createDirectiveView } from "./app.js";

export function register(sonder) {
  sonder.registerView(createDirectiveView(sonder));
  sonder.registerTopBarButton({
    id: "directive-launch",
    icon: "⌁",
    title: "Directive",
    onClick: () => sonder.openView("directive")
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
