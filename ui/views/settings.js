import { appendText, createElement } from "../primitives.js";

export function renderSettingsView(data = {}) {
  const root = createElement("section", "directive-expanded-settings settings-layout");
  root.dataset.directiveScrollOwner = "true";
  const content = createElement("div", "settings-content");
  content.dataset.directiveScrollOwner = "true";
  const authority = createElement("section", "settings-section");
  const header = createElement("header", "settings-section-head");
  header.append(
    appendText(createElement("span"), "Campaign authority"),
    appendText(createElement("h2"), "Directive campaign authority"),
    appendText(createElement("p"), "Directive reads committed, player-safe campaign state from the active Sonder story."),
  );
  const facts = createElement("div", "settings-facts");
  facts.append(
    fact("Simulation mode", literal(data.campaign?.simulation_mode, "Unavailable")),
    fact("Story lineage", "Committed story lineage"),
    fact("Player authority", "Player dialogue remains player-authored."),
  );
  authority.append(header, facts);

  const ownership = createElement("section", "settings-section");
  const ownershipHeader = createElement("header", "settings-section-head");
  ownershipHeader.append(
    appendText(createElement("span"), "Host ownership"),
    appendText(createElement("h2"), "Sonder configuration"),
    appendText(createElement("p"), "Sonder owns model and provider configuration."),
  );
  ownership.append(ownershipHeader, appendText(
    createElement("p"),
    "Directive does not duplicate host credentials, model choices, or unsupported campaign mutations.",
  ));
  content.append(authority, ownership);
  root.append(content);
  return root;
}

function fact(label, value) {
  const item = createElement("div");
  item.append(appendText(createElement("span"), label), appendText(createElement("strong"), value));
  return item;
}

function literal(value, unavailable) {
  return value === undefined || value === null || value === "" ? unavailable : String(value);
}
