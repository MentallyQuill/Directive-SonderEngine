import { appendText, createElement } from "../primitives.js";

export function renderSettingsView(data = {}) {
  const root = createElement("section", "directive-v1-settings");
  const authority = createElement("section", "directive-v1-settings-section");
  const header = createElement("header");
  header.append(
    appendText(createElement("span", "directive-v1-kicker"), "Campaign authority"),
    appendText(createElement("h2"), "Directive campaign authority"),
    appendText(createElement("p"), "Directive reads committed, player-safe campaign state from the active Sonder story."),
  );
  const facts = createElement("div", "directive-v1-settings-facts");
  facts.append(
    fact("Simulation mode", literal(data.campaign?.simulation_mode, "Unavailable")),
    fact("Story lineage", "Committed story lineage"),
    fact("Player authority", "Player dialogue remains player-authored."),
  );
  authority.append(header, facts);

  const ownership = createElement("section", "directive-v1-settings-section");
  const ownershipHeader = createElement("header");
  ownershipHeader.append(
    appendText(createElement("span", "directive-v1-kicker"), "Host ownership"),
    appendText(createElement("h2"), "Sonder configuration"),
    appendText(createElement("p"), "Sonder owns model and provider configuration."),
  );
  ownership.append(ownershipHeader, appendText(
    createElement("p"),
    "Directive does not duplicate host credentials, model choices, or unsupported campaign mutations.",
  ));
  root.append(authority, ownership);
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
