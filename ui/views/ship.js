import { appendText, createElement } from "../primitives.js";

export function renderShipView(data = {}) {
  const ship = data.ship || {};
  const cohesion = ship.cohesion || {};
  const root = createElement("section", "directive-v1-ship");
  root.append(renderIdentity(data.media?.ship, ship), renderReadiness(ship));

  const systems = createElement("section", "directive-v1-mission-section directive-v1-ship-systems");
  systems.append(appendText(createElement("h3"), "Ship systems"));
  const systemList = createElement("div", "directive-v1-system-list");
  for (const [index, system] of (ship.systems || []).entries()) {
    systemList.append(renderSystem(system, index === 0));
  }
  if (!(ship.systems || []).length) {
    systemList.append(appendText(createElement("p"), "No system condition records are available."));
  }
  systems.append(systemList);
  root.append(systems);

  root.append(renderReference("Available capabilities", ship.capabilities || []));
  root.append(renderReference("Material constraints", ship.constraints || []));
  root.append(renderCohesion(cohesion));
  return root;
}

function renderIdentity(media, ship) {
  const hero = createElement("header", "directive-v1-ship-hero");
  if (present(media?.variants?.hero)) {
    const image = createElement("img");
    image.src = media.variants.hero;
    image.alt = literal(media.alt, "");
    hero.append(image);
  }
  const identity = createElement("div", "directive-v1-ship-identity");
  identity.append(
    appendText(createElement("span", "directive-v1-kicker"), literal(ship.class_name, "Ship class unavailable.")),
    appendText(createElement("h2"), literal(ship.name, "Ship identity unavailable.")),
    appendText(createElement("p"), "Directive vessel command record"),
  );
  hero.append(identity);
  return hero;
}

function renderReadiness(ship) {
  const cohesion = ship.cohesion || {};
  const section = createElement("section", "directive-v1-operational-status");
  section.append(
    appendText(createElement("span", "directive-v1-kicker"), "Operational readiness"),
    appendText(createElement("h3"), literal(cohesion.band?.label, "Readiness unavailable.")),
    appendText(createElement("p", "directive-v1-operational-summary"), `${(ship.systems || []).length} system condition records`),
  );
  const readiness = createElement("div", "directive-v1-ship-readiness");
  readiness.append(
    appendText(createElement("span"), "Cohesion"),
    appendText(createElement("strong"), `Cohesion ${literal(cohesion.total, "unavailable")}`),
  );
  const segments = createElement("div", "directive-segments");
  segments.setAttribute("role", "img");
  segments.setAttribute("aria-label", `Cohesion ${literal(cohesion.total, "unavailable")} out of 100`);
  for (const segment of cohesion.segments || []) {
    const item = createElement("span", `directive-segment${segment.filled ? " is-filled" : " is-open"}`);
    item.dataset.segmentIndex = String(segment.index);
    item.title = literal(segment.issueId, "Ready");
    segments.append(item);
  }
  section.append(readiness, segments);
  return section;
}

function renderSystem(system, open) {
  const details = createElement("details", "directive-v1-system");
  details.dataset.systemId = String(system.id || "");
  details.open = open;
  const summary = createElement("summary", "directive-v1-section-heading");
  summary.append(
    appendText(createElement("strong"), literal(system.label, "Ship system")),
    appendText(createElement("span", "directive-v1-section-note"), literal(system.state?.label, "State unavailable")),
  );
  details.append(summary);
  if (present(system.summary)) details.append(appendText(createElement("p"), system.summary));
  if (present(system.state?.mechanicalEffect)) {
    details.append(appendText(createElement("p"), system.state.mechanicalEffect));
  }
  const orders = (system.work_orders || []).filter((order) => order.status !== "unknown");
  const heading = appendText(createElement("h4"), "Work orders");
  const list = createElement("ul", "directive-work");
  for (const order of orders) {
    const item = createElement("li", `is-${literal(order.status, "available")}`);
    item.append(appendText(createElement("strong"), literal(order.label, "Work order")));
    if (present(order.summary)) item.append(appendText(createElement("span"), order.summary));
    list.append(item);
  }
  if (!orders.length) list.append(appendText(createElement("li"), "No player-known work orders."));
  details.append(heading, list);
  return details;
}

function renderReference(title, records) {
  const section = createElement("section", "directive-v1-mission-section directive-v1-reference");
  section.append(appendText(createElement("h3"), title));
  const list = createElement("ul", "directive-v1-information-list");
  for (const record of records) {
    const item = createElement("li");
    item.append(appendText(createElement("strong"), literal(record.label, record.id || "Record")));
    if (present(record.summary)) item.append(document.createTextNode(`: ${record.summary}`));
    list.append(item);
  }
  if (!records.length) list.append(appendText(createElement("li"), `No ${title.toLowerCase()} are currently recorded.`));
  section.append(list);
  return section;
}

function renderCohesion(cohesion) {
  const section = createElement("section", "directive-v1-mission-section directive-v1-cohesion");
  section.append(appendText(createElement("h3"), "Cohesion priorities"));
  for (const issue of cohesion.issues || []) section.append(renderIssue(issue));
  if (!(cohesion.issues || []).length) {
    section.append(appendText(createElement("p"), "No command assignments require attention."));
  }
  if (integer(cohesion.queued_count) > 0) {
    const count = integer(cohesion.queued_count);
    section.append(appendText(
      createElement("p", "ship-cohesion-backlog"),
      `${count} additional assignment${count === 1 ? "" : "s"} queued`,
    ));
  }
  const history = createElement("details", "ship-cohesion-history");
  const completed = cohesion.completed || [];
  history.append(appendText(createElement("summary"), `Resolved assignments (${completed.length})`));
  const list = createElement("ul");
  for (const record of completed) {
    list.append(appendText(
      createElement("li"),
      `${literal(record.title, "Resolved assignment")} · +${literal(record.cohesionRestored, "0")} Cohesion`,
    ));
  }
  history.append(list);
  section.append(history);
  return section;
}

function renderIssue(issue) {
  const details = createElement("details", "ship-task-detail");
  details.dataset.cohesionIssueId = String(issue.id || "");
  const summary = createElement("summary");
  summary.append(
    appendText(createElement("strong"), literal(issue.player_text?.title, "Command assignment")),
    document.createTextNode(` · Level ${literal(issue.level, "unavailable")}`),
  );
  details.append(summary);
  const fields = [
    ["Situation", issue.player_text?.situation],
    ["Command Impact", issue.player_text?.commandImpact],
    ["Course of Action", issue.player_text?.courseOfAction],
    ["Operational Risk", issue.player_text?.operationalRisk],
    ["Resolution Criteria", issue.player_text?.resolutionCriteria],
  ];
  for (const [label, value] of fields) {
    if (!present(value)) continue;
    const block = createElement("section", "ship-task-detail-section");
    block.append(appendText(createElement("h4"), label), appendText(createElement("p"), value));
    details.append(block);
  }
  return details;
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function literal(value, unavailable) {
  return present(value) ? String(value) : unavailable;
}

function integer(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
