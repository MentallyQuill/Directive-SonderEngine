import { appendText, createElement, setClassState } from "../primitives.js";

export function renderShipView(data = {}) {
  const ship = data.ship || {};
  const cohesion = ship.cohesion || {};
  const root = createElement("section", "directive-expanded-ship ship-route");
  root.dataset.directiveScrollOwner = "true";

  const workspace = createElement("section", "ship-cohesion-workspace");
  workspace.dataset.directiveScrollOwner = "true";
  const header = createElement("header", "ship-cohesion-header");
  const identity = createElement("div", "ship-cohesion-identity");
  identity.append(
    appendText(createElement("span"), literal(ship.class_name, "Ship class unavailable.")),
    appendText(createElement("h2"), literal(ship.name, "Ship identity unavailable.")),
  );
  const score = createElement("div", `ship-cohesion-score is-${literal(cohesion.band?.id, "unknown")}`);
  score.append(
    appendText(createElement("strong"), `Cohesion ${literal(cohesion.total, "unavailable")}`),
    appendText(createElement("span"), literal(cohesion.band?.label, "Readiness unavailable.")),
  );
  header.append(identity, score);

  const stage = createElement("div", "ship-cohesion-stage");
  const orbit = createElement("div", "ship-cohesion-orbit");
  orbit.append(createRing(cohesion));
  const media = data.media?.ship;
  const visual = createElement("figure", "ship-cohesion-visual directive-media-frame");
  const cohesionMedia = media?.variants?.cohesion || media?.variants?.hero;
  if (present(cohesionMedia)) {
    const image = createElement("img", "directive-media-image");
    image.src = cohesionMedia;
    image.alt = literal(media.alt, "");
    visual.append(image);
  } else {
    visual.append(appendText(createElement("span", "directive-media-placeholder"), "Vessel image unavailable"));
  }
  orbit.append(visual);

  const leaders = createSvg("svg", "ship-task-leaders is-layout-unavailable");
  leaders.setAttribute("viewBox", "0 0 100 100");
  leaders.setAttribute("aria-hidden", "true");
  orbit.append(leaders);

  const issues = cohesion.issues || [];
  const nav = createElement("nav", "ship-task-nav");
  nav.setAttribute("aria-label", "Available command assignments");
  const mobileCallouts = createElement("div", "ship-task-mobile-callouts");
  mobileCallouts.setAttribute("aria-label", "Command assignment locations");
  const detail = createElement("section", "ship-task-detail");
  detail.id = "ship-task-detail";
  detail.setAttribute("aria-live", "polite");
  const buttons = [];
  const mobileBadges = [];
  const mobilePanels = [];
  let expandedId = null;
  for (const [index, issue] of issues.entries()) {
    const button = createTaskButton(issue, index);
    const panelId = `ship-task-mobile-panel-${index}`;
    button.id = `ship-task-button-${index}`;
    button.setAttribute("aria-controls", `ship-task-detail ${panelId}`);
    button.style.left = `${index % 2 === 0 ? 4 : 73}%`;
    button.style.top = `${10 + (index * 19)}%`;
    button.addEventListener("click", () => {
      select(issue.id);
      toggleExpanded(issue.id);
    });
    buttons.push(button);
    const mobilePanel = createElement("section", "ship-task-mobile-panel");
    mobilePanel.id = panelId;
    mobilePanel.hidden = true;
    mobilePanel.setAttribute("role", "region");
    mobilePanel.setAttribute("aria-labelledby", button.id);
    const mobileContent = createElement("div", "ship-task-detail-content");
    mobileContent.append(renderIssue(issue, true));
    mobilePanel.append(mobileContent);
    mobilePanels.push(mobilePanel);
    nav.append(button, mobilePanel);

    const badge = createMobileCallout(issue, index);
    badge.setAttribute("aria-controls", panelId);
    badge.addEventListener("click", () => {
      select(issue.id);
      toggleExpanded(issue.id, true);
    });
    mobileBadges.push(badge);
    mobileCallouts.append(badge);
    leaders.append(createLeader(issue, index));
  }
  if (issues.length) leaders.classList.remove("is-layout-unavailable");
  orbit.append(nav, mobileCallouts);
  stage.append(orbit, detail);
  workspace.append(header, stage);

  if (issues.length) select(issues[0].id);
  else detail.append(appendText(createElement("p", "ship-cohesion-empty"), "No command assignments require attention."));

  if (integer(cohesion.queued_count) > 0) {
    const count = integer(cohesion.queued_count);
    workspace.append(appendText(createElement("p", "ship-cohesion-backlog"), `${count} additional assignment${count === 1 ? "" : "s"} queued`));
  }
  workspace.append(createHistory(cohesion.completed || []));
  workspace.append(createSystems(ship.systems || []));
  workspace.append(createReferences(ship));
  root.append(workspace);
  return root;

  function select(issueId) {
    const issue = issues.find((record) => record.id === issueId) || issues[0];
    if (!issue) return;
    for (const button of buttons) {
      const active = button.dataset.taskId === String(issue.id || "");
      setClassState(button, "is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("aria-expanded", active ? "true" : "false");
    }
    for (const badge of mobileBadges) {
      const active = badge.dataset.taskId === String(issue.id || "");
      setClassState(badge, "is-selected", active);
      badge.setAttribute("aria-pressed", active ? "true" : "false");
    }
    const content = createElement("div", "ship-task-detail-content");
    content.append(renderIssue(issue, true));
    detail.replaceChildren(content);
  }

  function toggleExpanded(issueId, forceOpen = false) {
    expandedId = forceOpen ? issueId : (expandedId === issueId ? null : issueId);
    for (const [index, button] of buttons.entries()) {
      const expanded = button.dataset.taskId === String(expandedId || "");
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      mobilePanels[index].hidden = !expanded;
    }
  }
}

function createRing(cohesion) {
  const ring = createElement("div", "ship-cohesion-ring");
  ring.setAttribute("role", "list");
  ring.setAttribute("aria-label", `Cohesion ${literal(cohesion.total, "unavailable")} out of 100`);
  const back = createSvg("svg", "ship-cohesion-ring-layer is-back");
  const front = createSvg("svg", "ship-cohesion-ring-layer is-front");
  for (const layer of [back, front]) {
    layer.setAttribute("viewBox", "0 0 100 100");
    layer.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
  for (const segment of cohesion.segments || []) {
    const group = createSvg("g", `ship-cohesion-segment ${segment.filled ? "is-filled" : "is-debt"}`);
    group.dataset.segmentIndex = String(segment.index);
    if (segment.issueId) group.dataset.taskId = String(segment.issueId);
    group.setAttribute("role", "listitem");
    const path = createSvg("path", "ship-cohesion-segment-shape is-desktop");
    path.setAttribute("d", ringSegmentPath(segment.index));
    const mobilePath = createSvg("path", "ship-cohesion-segment-shape is-mobile");
    mobilePath.setAttribute("d", ringSegmentPath(segment.index));
    group.append(path, mobilePath);
    (segment.index < 10 ? back : front).append(group);
  }
  ring.append(back, front);
  return ring;
}

function ringSegmentPath(index) {
  const start = -90 + (index * 18) + 1;
  const end = start + 16;
  const point = (radius, degrees) => {
    const angle = degrees * Math.PI / 180;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  };
  const outerStart = point(46, start);
  const outerEnd = point(46, end);
  const innerEnd = point(42, end);
  const innerStart = point(42, start);
  return `M ${outerStart[0]} ${outerStart[1]} A 46 46 0 0 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A 42 42 0 0 0 ${innerStart[0]} ${innerStart[1]} Z`;
}

function createTaskButton(issue, index) {
  const button = createElement("button", "ship-task-button");
  button.type = "button";
  button.dataset.taskId = String(issue.id || "");
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-expanded", "false");
  const title = createElement("span", "ship-task-button-title");
  const icon = createTaskIcon(issue, index);
  title.append(
    appendText(createElement("span", "ship-task-desktop-level"), `L${literal(issue.level, index + 1)}`),
    icon,
    appendText(createElement("strong"), literal(issue.player_text?.title, "Command assignment")),
    createElement("span", "ship-task-disclosure"),
  );
  const info = createElement("span", "ship-task-button-info");
  info.append(
    appendText(createElement("span", "ship-task-button-next"), issue.current_phase ? `Next: ${literal(issue.current_phase.label, "Available")}` : "Ready for resolution"),
    appendText(createElement("span", "ship-task-reward"), `+${literal(issue.cohesion, "0")} Cohesion`),
  );
  button.append(title, info);
  return button;
}

function createMobileCallout(issue, index) {
  const slots = [[18, 8], [67, 8], [78, 42], [57, 72], [31, 72]];
  const [left, top] = slots[index % slots.length];
  const button = createElement("button", "ship-task-mobile-callout");
  button.type = "button";
  button.dataset.taskId = String(issue.id || "");
  button.style.left = `${left}%`;
  button.style.top = `${top}%`;
  button.setAttribute("aria-label", `${literal(issue.player_text?.title, "Command assignment")}, level ${literal(issue.level, index + 1)}, restores ${literal(issue.cohesion, 0)} Cohesion`);
  button.setAttribute("aria-pressed", "false");
  button.append(createTaskIcon(issue, index), appendText(createElement("span", "ship-task-mobile-level"), `L${literal(issue.level, index + 1)}`));
  return button;
}

function createTaskIcon(issue, index) {
  const families = ["systems", "coordination", "personnel", "training", "life"];
  const icon = createElement("span", "ship-task-category-icon");
  icon.dataset.icon = present(issue.primary_family) ? String(issue.primary_family) : families[index % families.length];
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createLeader(issue, index) {
  const slots = [[24, 15], [71, 15], [83, 48], [62, 78], [36, 78]];
  const anchors = {
    bridge: [58, 28], "forward-sensors": [72, 48], "central-saucer": [58, 48],
    "crew-habitat": [49, 56], engineering: [34, 31], "port-nacelle": [18, 25],
    "starboard-nacelle": [46, 22], "aft-hull": [30, 34], shuttlebay: [28, 27], sickbay: [55, 45],
  };
  const [startX, startY] = slots[index % slots.length];
  const [endX, endY] = anchors[issue.anchor] || [50, 45 + ((index % 3) * 7)];
  const line = createSvg("polyline", "ship-task-leader");
  line.dataset.taskId = String(issue.id || "");
  line.setAttribute("points", `${startX},${startY} ${(startX + endX) / 2},${startY} ${endX},${endY}`);
  return line;
}

function renderIssue(issue, open) {
  const details = createElement("details", "directive-cohesion-disclosure");
  details.dataset.cohesionIssueId = String(issue.id || "");
  details.open = open;
  const summary = createElement("summary");
  summary.append(
    appendText(createElement("strong"), literal(issue.player_text?.title, "Command assignment")),
    document.createTextNode(` · Level ${literal(issue.level, "unavailable")}`),
  );
  details.append(summary);
  for (const [label, value] of [
    ["Situation", issue.player_text?.situation],
    ["Objective", issue.player_text?.objective],
    ["Why It Matters", issue.player_text?.whyItMatters],
    ["Operational Effect", issue.player_text?.operationalEffect],
  ]) {
    if (!present(value)) continue;
    const section = createElement("section", `ship-task-detail-section${label === "Why It Matters" ? " ship-task-why" : ""}`);
    section.append(appendText(createElement("h4"), label), appendText(createElement("p"), value));
    details.append(section);
  }
  if (issue.current_phase) {
    const current = createElement("section", "ship-task-detail-section");
    current.append(
      appendText(createElement("h4"), "Current phase"),
      appendText(createElement("p", "ship-task-next-step"), [issue.current_phase.label, issue.current_phase.status].filter(present).join(" · ")),
    );
    if (present(issue.current_phase.summary)) current.append(appendText(createElement("p"), issue.current_phase.summary));
    details.append(current);
  }
  if (Array.isArray(issue.phases) && issue.phases.length) {
    const phases = createElement("section", "ship-task-detail-section");
    phases.append(appendText(createElement("h4"), "Assignment phases"));
    const list = createElement("ul", "directive-work");
    for (const phase of issue.phases) {
      const item = createElement("li");
      item.append(appendText(createElement("strong"), [phase.label, phase.status].filter(present).join(" · ")));
      if (present(phase.summary)) item.append(appendText(createElement("span"), phase.summary));
      list.append(item);
    }
    phases.append(list);
    details.append(phases);
  }
  if (present(issue.computer_help)) {
    const help = createElement("section", "ship-task-detail-section");
    help.append(appendText(createElement("h4"), "Computer help"), appendText(createElement("p", "ship-task-computer-help"), issue.computer_help));
    details.append(help);
  }
  return details;
}

function createSystems(systems) {
  const section = createElement("section", "ship-records settings-section");
  const head = createElement("header", "settings-section-head");
  head.append(appendText(createElement("span"), "Operational record"), appendText(createElement("h2"), "Ship systems"));
  section.append(head);
  for (const [index, system] of systems.entries()) {
    const details = createElement("details", "directive-v1-system");
    details.dataset.systemId = String(system.id || "");
    details.open = index === 0;
    const summary = createElement("summary", "directive-v1-section-heading");
    summary.append(
      appendText(createElement("strong"), literal(system.label, "Ship system")),
      appendText(createElement("span", "directive-v1-section-note"), literal(system.state?.label, "State unavailable")),
    );
    details.append(summary);
    if (present(system.summary)) details.append(appendText(createElement("p"), system.summary));
    if (present(system.state?.mechanicalEffect)) details.append(appendText(createElement("p"), system.state.mechanicalEffect));
    const list = createElement("ul", "directive-work");
    for (const order of (system.work_orders || []).filter((record) => record.status !== "unknown")) {
      const item = createElement("li");
      item.append(appendText(createElement("strong"), literal(order.label, "Work order")));
      if (present(order.summary)) item.append(appendText(createElement("span"), order.summary));
      list.append(item);
    }
    details.append(appendText(createElement("h4"), "Work orders"), list);
    section.append(details);
  }
  return section;
}

function createReferences(ship) {
  const section = createElement("section", "ship-records settings-section");
  const head = createElement("header", "settings-section-head");
  head.append(appendText(createElement("span"), "Command reference"), appendText(createElement("h2"), "Capabilities and constraints"));
  section.append(head);
  for (const record of [...(ship.capabilities || []), ...(ship.constraints || [])]) {
    section.append(appendText(createElement("p"), `${literal(record.label, record.id || "Record")}: ${literal(record.summary, "Detail unavailable.")}`));
  }
  return section;
}

function createHistory(records) {
  const history = createElement("details", "ship-completed-history ship-cohesion-history");
  history.append(appendText(createElement("summary"), `Resolved assignments (${records.length})`));
  const list = createElement("ul");
  for (const record of records) list.append(appendText(createElement("li"), `${literal(record.title, "Resolved assignment")} · +${literal(record.cohesionRestored, "0")} Cohesion`));
  history.append(list);
  return history;
}

function createSvg(tagName, className) {
  const value = typeof document.createElementNS === "function"
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : createElement(tagName);
  value.setAttribute("class", className);
  return value;
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
