import { appendText, createElement } from "../primitives.js";

export function renderMissionView(data = {}) {
  const mission = data.mission || {};
  const root = createElement("section", "directive-expanded-mission mission-layout mission-journal");
  root.dataset.directiveScrollOwner = "true";

  const collection = createElement("aside", "mission-collection mission-index-panel mission-desktop-collection");
  collection.dataset.directiveScrollOwner = "true";
  const collectionHead = createElement("header", "mission-index-head");
  collectionHead.append(
    appendText(createElement("span"), "Active record"),
    appendText(createElement("h2"), "Mission"),
  );
  collection.append(collectionHead, createMissionRow(mission, "article"));

  const detail = createElement("section", "mission-detail mission-desktop-detail");
  detail.dataset.directiveScrollOwner = "true";
  appendMissionDetail(detail, mission, data);
  detail.append(renderBearing(data.command_bearing || {}));

  const mobile = createElement("section", "mission-mobile-accordion");
  mobile.dataset.directiveScrollOwner = "true";
  const record = createElement("article", "mission-mobile-record");
  const trigger = createMissionRow(mission, "button");
  trigger.className += " mission-mobile-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-expanded", "true");
  const mobileDetail = createElement("div", "mission-mobile-detail");
  appendMissionDetail(mobileDetail, mission, data, true);
  record.append(trigger, mobileDetail);
  mobile.append(record);

  root.append(collection, detail, mobile);
  return root;
}

function createMissionRow(mission, tagName) {
  const row = createElement(tagName, "mission-row active");
  row.dataset.missionId = String(mission.id || "");
  row.append(
    appendText(createElement("span", "mission-row-state"), literal(mission.status, "Status unavailable")),
    appendText(createElement("strong"), literal(mission.title, literal(mission.id, "Mission identity unavailable."))),
    appendText(createElement("p"), literal(mission.summary, `Revision ${literal(mission.revision, "unavailable")} · ${literal(mission.status, "Status unavailable")}`)),
  );
  return row;
}

function appendMissionDetail(container, mission, data, compactIdentity = false) {
  const hero = createElement("header", `mission-hero${compactIdentity ? " mission-hero-compact-identity" : ""}`);
  if (!compactIdentity) {
    hero.append(
      appendText(createElement("span", "mission-status"), mission.status === "terminal" ? "Completed mission" : "Current mission"),
      appendText(createElement("h2"), literal(mission.title, literal(mission.id, "Mission identity unavailable."))),
    );
  }
  hero.append(appendText(createElement("p"), literal(mission.summary, `Revision ${literal(mission.revision, "unavailable")} · ${literal(mission.status, "Status unavailable")}`)));
  const time = data.time || {};
  if (present(time.clock_display) || present(time.stardate)) {
    const chronometer = createElement("div", "directive-ship-chronometer directive-ship-chronometer-mission");
    chronometer.append(
      appendText(createElement("span", "directive-ship-chronometer-label"), "Ship time"),
      appendText(createElement("strong", "directive-ship-chronometer-clock"), literal(time.clock_display, "Unavailable")),
      appendText(createElement("span", "directive-ship-chronometer-stardate"), present(time.stardate) ? `Stardate ${time.stardate}` : "Stardate unavailable"),
    );
    hero.append(chronometer);
  }
  container.append(hero);
  appendObjectiveGroup(container, mission.objectives || []);
  appendOutcome(container, mission.outcome_dimensions || {});
  appendTransition(container, data.journey?.last_transition);
}

function appendObjectiveGroup(container, objectives) {
  const section = createElement("section", "mission-detail-section");
  const heading = createElement("header", "mission-section-heading");
  heading.append(
    appendText(createElement("h3"), "Primary objectives"),
    appendText(createElement("span"), `${objectives.length} visible`),
  );
  const list = createElement("div", "mission-objective-list");
  for (const objective of objectives) {
    const terminal = objective.state === "terminal";
    const row = createElement("article", `mission-objective-row${terminal ? " is-resolved" : ""}`);
    row.dataset.objectiveId = String(objective.id || "");
    const marker = appendText(createElement("span", "mission-objective-marker"), terminal ? "✓" : "□");
    marker.setAttribute("aria-hidden", "true");
    const copy = createElement("div", "mission-objective-copy");
    copy.append(
      appendText(createElement("strong"), literal(objective.title, "Objective title unavailable.")),
      appendText(createElement("p"), literal(objective.terminal_text || objective.summary, "Objective detail unavailable.")),
    );
    row.append(
      marker,
      copy,
      appendText(createElement("span", "mission-objective-status"), literal(objective.disposition || objective.state, "Status unavailable")),
    );
    list.append(row);
  }
  if (!objectives.length) list.append(appendText(createElement("p"), "No visible objectives are available."));
  section.append(heading, list);
  container.append(section);
}

function appendOutcome(container, outcomes) {
  if (!Object.keys(outcomes).length) return;
  const section = createElement("section", "mission-detail-section");
  section.append(appendText(createElement("h3"), "Outcome record"));
  const list = createElement("ul", "mission-information-list");
  for (const [key, value] of Object.entries(outcomes)) list.append(appendText(createElement("li"), `${key}: ${value}`));
  section.append(list);
  container.append(section);
}

function appendTransition(container, transition) {
  if (!transition) return;
  const section = createElement("section", "mission-detail-section");
  section.append(appendText(createElement("h3"), "Latest transition"));
  const list = createElement("ul", "mission-information-list");
  list.append(appendText(createElement("li"), literal(transition.next?.player_safe_setup, "No player-known transition setup is available.")));
  for (const summary of transition.outcome_summary || []) list.append(appendText(createElement("li"), summary));
  section.append(list);
  container.append(section);
}

function renderBearing(bearing) {
  const section = createElement("section", "directive-v1-command-bearing directive-command-bearing-strip");
  const available = Number.isInteger(bearing.balance) && bearing.balance >= 0
    && Number.isInteger(bearing.capacity) && bearing.capacity > 0;
  if (!available) {
    section.append(
      appendText(createElement("span", "directive-v1-kicker"), "Command Bearing"),
      appendText(createElement("p"), "Command Bearing unavailable."),
    );
    return section;
  }
  const copy = createElement("div", "directive-command-bearing-copy");
  copy.append(
    appendText(createElement("span", "directive-v1-kicker"), "Command Bearing"),
    appendText(createElement("h2"), `${bearing.balance} of ${bearing.capacity} available`),
    appendText(createElement("p"), literal(bearing.latest_award_reason, "A reserve earned through meaningful command decisions.")),
  );
  const pips = createElement("div", "directive-v1-command-bearing-pips directive-command-bearing-pips");
  pips.setAttribute("aria-label", `${bearing.balance} of ${bearing.capacity} Command Bearing available`);
  for (let index = 0; index < bearing.capacity; index += 1) {
    const pip = createElement("span", index < bearing.balance ? "is-filled" : "");
    pip.setAttribute("aria-hidden", "true");
    pips.append(pip);
  }
  section.append(copy, pips);
  if (bearing.pending_edge) section.append(appendText(createElement("p", "directive-v1-command-bearing-pending"), literal(bearing.pending_edge.reason, "A favorable edge is pending.")));
  return section;
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function literal(value, unavailable) {
  return present(value) ? String(value) : unavailable;
}
