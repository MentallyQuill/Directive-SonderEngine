import { appendText, createElement } from "../primitives.js";

export function renderMissionView(data = {}) {
  const mission = data.mission || {};
  const root = createElement("section", "directive-v1-mission");
  root.append(renderBriefing(mission), renderObjectives(mission.objectives || []));

  if (Object.keys(mission.outcome_dimensions || {}).length) {
    root.append(renderOutcomes(mission.outcome_dimensions));
  }
  if (data.journey?.last_transition) {
    root.append(renderTransition(data.journey.last_transition));
  }
  root.append(renderBearing(data.command_bearing || {}));
  return root;
}

function renderBriefing(mission) {
  const header = createElement("header", "directive-v1-mission-hero");
  header.append(
    appendText(createElement("span", "directive-v1-kicker"), "Mission briefing"),
    appendText(createElement("h2"), literal(mission.id, "Mission identity unavailable.")),
    appendText(
      createElement("p"),
      `Revision ${literal(mission.revision, "unavailable")} · ${literal(mission.status, "Status unavailable")}`,
    ),
  );
  const objectives = Array.isArray(mission.objectives) ? mission.objectives : [];
  const resolved = objectives.filter((objective) => objective.state === "terminal").length;
  header.append(appendText(
    createElement("div", "directive-v1-mission-progress"),
    `${resolved} of ${objectives.length} visible objectives resolved`,
  ));
  return header;
}

function renderObjectives(objectives) {
  const section = createElement("section", "directive-v1-mission-section");
  const heading = createElement("header", "directive-v1-section-heading");
  heading.append(
    appendText(createElement("h3"), "Objectives"),
    appendText(createElement("span", "directive-v1-section-note"), `${objectives.length} visible`),
  );
  const grid = createElement("div", "directive-v1-objective-grid");
  for (const objective of objectives) {
    const terminal = objective.state === "terminal";
    const card = createElement("article", `directive-v1-objective${terminal ? " is-terminal" : ""}`);
    card.dataset.objectiveId = String(objective.id || "");
    const marker = appendText(createElement("span", "directive-v1-objective-marker"), terminal ? "✓" : "□");
    marker.setAttribute("aria-hidden", "true");
    const copy = createElement("div", "directive-v1-objective-copy");
    copy.append(
      appendText(createElement("strong"), literal(objective.title, "Objective title unavailable.")),
      appendText(
        createElement("p"),
        literal(objective.terminal_text || objective.summary, "Objective detail unavailable."),
      ),
    );
    const status = appendText(
      createElement("span", "directive-v1-objective-status"),
      literal(objective.disposition || objective.state, "Status unavailable"),
    );
    card.append(marker, copy, status);
    grid.append(card);
  }
  if (!objectives.length) grid.append(appendText(createElement("p"), "No visible objectives are available."));
  section.append(heading, grid);
  return section;
}

function renderOutcomes(outcomes) {
  const section = createElement("section", "directive-v1-mission-section");
  section.append(appendText(createElement("h3"), "Outcome record"));
  const list = createElement("dl", "directive-definitions");
  for (const [key, value] of Object.entries(outcomes)) {
    list.append(appendText(createElement("dt"), key), appendText(createElement("dd"), value));
  }
  section.append(list);
  return section;
}

function renderTransition(transition) {
  const section = createElement("section", "directive-v1-mission-section");
  section.append(appendText(createElement("h3"), "Latest transition"));
  const setup = transition.next?.player_safe_setup;
  section.append(appendText(
    createElement("p"),
    literal(setup, "No player-known transition setup is available."),
  ));
  for (const summary of transition.outcome_summary || []) {
    section.append(appendText(createElement("p"), summary));
  }
  return section;
}

function renderBearing(bearing) {
  const section = createElement("section", "directive-v1-command-bearing");
  const available = Number.isInteger(bearing.balance)
    && bearing.balance >= 0
    && Number.isInteger(bearing.capacity)
    && bearing.capacity > 0;
  if (!available) {
    section.append(
      appendText(createElement("span", "directive-v1-kicker"), "Command Bearing"),
      appendText(createElement("p"), "Command Bearing unavailable."),
    );
    return section;
  }
  const copy = createElement("div");
  copy.append(
    appendText(createElement("span", "directive-v1-kicker"), "Command Bearing"),
    appendText(
      createElement("h2"),
      `${literal(bearing.balance, "0")} of ${literal(bearing.capacity, "0")} available`,
    ),
    appendText(
      createElement("p"),
      literal(bearing.latest_award_reason, "A reserve earned through meaningful command decisions."),
    ),
  );
  const pips = createElement("div", "directive-v1-command-bearing-pips");
  const capacity = integer(bearing.capacity);
  const balance = integer(bearing.balance);
  pips.setAttribute("aria-label", `${balance} of ${capacity} Command Bearing available`);
  for (let index = 0; index < capacity; index += 1) {
    const pip = createElement("span", index < balance ? "is-filled" : "");
    pip.setAttribute("aria-hidden", "true");
    pips.append(pip);
  }
  section.append(copy, pips);
  if (bearing.pending_edge) {
    section.append(appendText(
      createElement("p", "directive-v1-command-bearing-pending"),
      literal(bearing.pending_edge.reason, "A favorable edge is pending."),
    ));
  }
  return section;
}

function literal(value, unavailable) {
  return value === undefined || value === null || value === "" ? unavailable : String(value);
}

function integer(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
