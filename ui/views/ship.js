import { appendText, createElement, setClassState } from "../primitives.js";
import { createShipCalloutLayout } from "../ship-callout-layout.js";

export function renderShipView(data = {}, actions = {}) {
  const ship = data.ship || {};
  const cohesion = ship.cohesion || {};
  const root = createElement("section", "directive-expanded-ship ship-route");
  root.dataset.directiveScrollOwner = "true";

  const workspace = createElement("section", "ship-cohesion-workspace");
  workspace.dataset.directiveScrollOwner = "true";
  const header = createElement("header", "ship-cohesion-header");
  const identity = createElement("div", "ship-cohesion-identity");
  identity.append(
    appendText(createElement("span"), [ship.class_name, ship.registry].filter(present).join(" · ") || "Ship class unavailable."),
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
    button.dataset.anchor = String(issue.anchor || "");
    const panelId = `ship-task-mobile-panel-${index}`;
    button.id = `ship-task-button-${index}`;
    button.setAttribute("aria-controls", `ship-task-detail ${panelId}`);
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
    mobilePanel.append(renderIssue(issue, false, data.command_bearing, actions));
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
    const leader = createSvg("polyline", "ship-task-leader");
    leader.dataset.taskId = String(issue.id || "");
    leaders.append(leader);
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
  installCalloutLayout({
    workspace,
    orbit,
    visual,
    leaders,
    buttons,
    mobileCallouts,
    mobileBadges,
    tasks: issues,
    shipId: ship.id || ship.registry || ship.name || "",
    visualAnchors: media?.anchors || {},
  });
  return root;

  function select(issueId) {
    const issue = issues.find((record) => record.id === issueId) || issues[0];
    if (!issue) return;
    for (const button of buttons) {
      const active = button.dataset.taskId === String(issue.id || "");
      setClassState(button, "is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    for (const badge of mobileBadges) {
      const active = badge.dataset.taskId === String(issue.id || "");
      setClassState(badge, "is-selected", active);
      badge.setAttribute("aria-pressed", active ? "true" : "false");
    }
    detail.replaceChildren(renderIssue(issue, true, data.command_bearing, actions));
    for (const segment of orbit.querySelectorAll(".ship-cohesion-segment")) {
      segment.classList.toggle("is-preview", segment.dataset.taskId === String(issue.id || ""));
    }
    for (const leader of leaders.querySelectorAll(".ship-task-leader")) {
      leader.classList.toggle("is-active", leader.dataset.taskId === String(issue.id || ""));
    }
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
    group.style.setProperty("--ship-cohesion-index", String(segment.index));
    group.style.setProperty("--ship-cohesion-wave-delay", `${-((segment.index + 1) * 0.5)}s`);
    if (segment.queued) group.classList.add("is-queued");
    const taskId = segment.taskId || segment.issueId;
    if (taskId) group.dataset.taskId = String(taskId);
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
  const centerRadius = 44;
  const bandWidth = 3.2;
  const gapDegrees = 2;
  const cornerRadius = 0.4;
  const outerRadius = centerRadius + (bandWidth / 2);
  const innerRadius = centerRadius - (bandWidth / 2);
  const start = -90 + (index * 18) + (gapDegrees / 2);
  const end = -90 + ((index + 1) * 18) - (gapDegrees / 2);
  const outerInset = cornerRadius * (180 / Math.PI) / outerRadius;
  const innerInset = cornerRadius * (180 / Math.PI) / innerRadius;
  const point = (radius, degrees) => {
    const angle = degrees * Math.PI / 180;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  };
  const format = ([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`;
  const outerStartFace = point(outerRadius - cornerRadius, start);
  const outerStartCorner = point(outerRadius, start);
  const outerStartArc = point(outerRadius, start + outerInset);
  const outerEndArc = point(outerRadius, end - outerInset);
  const outerEndCorner = point(outerRadius, end);
  const outerEndFace = point(outerRadius - cornerRadius, end);
  const innerEndFace = point(innerRadius + cornerRadius, end);
  const innerEndCorner = point(innerRadius, end);
  const innerEndArc = point(innerRadius, end - innerInset);
  const innerStartArc = point(innerRadius, start + innerInset);
  const innerStartCorner = point(innerRadius, start);
  const innerStartFace = point(innerRadius + cornerRadius, start);
  return [
    `M ${format(outerStartFace)}`,
    `Q ${format(outerStartCorner)} ${format(outerStartArc)}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${format(outerEndArc)}`,
    `Q ${format(outerEndCorner)} ${format(outerEndFace)}`,
    `L ${format(innerEndFace)}`,
    `Q ${format(innerEndCorner)} ${format(innerEndArc)}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${format(innerStartArc)}`,
    `Q ${format(innerStartCorner)} ${format(innerStartFace)}`,
    `L ${format(outerStartFace)}`,
    "Z",
  ].join(" ");
}

function createTaskButton(issue, index) {
  const button = createElement("button", "ship-task-button");
  button.type = "button";
  button.dataset.taskId = String(issue.id || "");
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-expanded", "false");
  const title = createElement("span", "ship-task-button-title");
  const icon = createTaskIcon(issue, index);
  title.append(appendText(createElement("span", "ship-task-desktop-level"), `L${literal(issue.level, index + 1)}`));
  if (icon) title.append(icon);
  title.append(
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
  const button = createElement("button", "ship-task-mobile-callout");
  button.type = "button";
  button.dataset.taskId = String(issue.id || "");
  button.setAttribute("aria-label", `${literal(issue.player_text?.title, "Command assignment")}, level ${literal(issue.level, index + 1)}, restores ${literal(issue.cohesion, 0)} Cohesion`);
  button.setAttribute("aria-pressed", "false");
  const icon = createTaskIcon(issue, index);
  if (icon) button.append(icon);
  button.append(appendText(createElement("span", "ship-task-mobile-level"), `L${literal(issue.level, index + 1)}`));
  return button;
}

function createTaskIcon(issue, index) {
  const families = ["systems", "coordination", "personnel", "training"];
  const familyAliases = { shipboardLife: "life" };
  const authored = present(issue.primary_family) ? String(issue.primary_family) : "";
  const iconName = familyAliases[authored] || (families.includes(authored) ? authored : "");
  if (!iconName) return null;
  const icon = createElement("span", "ship-task-category-icon");
  icon.dataset.icon = iconName;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function renderIssue(issue, includeHeader, commandBearing = {}, actions = {}) {
  const text = issue.player_text || issue.playerText || {};
  const currentPhase = issue.current_phase || issue.currentPhase;
  const reward = issue.reward || { cohesion: issue.cohesion || 0, segments: issue.level || 0 };
  const content = createElement("div", "ship-task-detail-content");
  if (includeHeader) {
    const header = createElement("header", "ship-task-detail-header");
    const identity = createElement("div");
    identity.append(appendText(createElement("span", "ship-task-detail-eyebrow"), `Level ${literal(issue.level, "unavailable")} Command Assignment`));
    const titleRow = createElement("div", "ship-task-title-row");
    const titleIcon = createTaskIcon(issue, 0);
    if (titleIcon) titleRow.append(titleIcon);
    titleRow.append(appendText(createElement("h3"), literal(text.title, "Command assignment")));
    identity.append(titleRow);
    header.append(identity, createReward(reward));
    content.append(header);
  } else {
    content.append(appendText(createElement("span", "ship-task-detail-eyebrow"), `Level ${literal(issue.level, "unavailable")} Command Assignment`));
  }
  appendIssueCopy(content, "Situation", text.situation);
  appendIssueCopy(content, "Objective", text.objective);
  appendIssueCopy(content, "Command Impact", text.whyItMatters, "ship-task-why");
  const pursue = createElement("section", "ship-task-detail-section ship-task-pursue");
  pursue.append(
    appendText(createElement("h4"), "Course of Action"),
    appendText(createElement("p", "ship-task-next-step"), currentPhase ? `Next: ${literal(currentPhase.label, "Available")}` : "This assignment is ready for resolution."),
  );
  const approaches = createElement("ul", "ship-task-approaches");
  for (const approach of issue.approaches || []) approaches.append(appendText(createElement("li"), approach));
  pursue.append(approaches, appendText(createElement("p", "ship-task-computer-help"), `You can always ask the ship's computer for help. ${literal(issue.computer_help || issue.computerHelp, "")}`));
  content.append(pursue);
  appendIssueCopy(content, "Operational Risk", text.operationalEffect, "ship-task-impact");
  const completed = (issue.phases || []).filter(({ status }) => status === "completed").length;
  content.append(appendText(createElement("p", "ship-task-progress"), `Progress · ${completed} of ${(issue.phases || []).length} objectives complete`));
  const command = createElement("div", "ship-command-relief");
  const pending = commandBearing?.pending_cohesion_relief || commandBearing?.pendingCohesionRelief || null;
  const button = createElement("button", "ship-command-relief-button");
  const commandError = createElement("p", "ship-command-relief-error");
  commandError.setAttribute("role", "alert");
  commandError.setAttribute("aria-live", "assertive");
  commandError.hidden = true;
  const showCommandError = (cause) => {
    commandError.textContent = cause?.message || String(cause || "Command Bearing action failed.");
    commandError.hidden = false;
  };
  button.type = "button";
  if (pending?.target_issue_id === issue.id || pending?.targetIssueId === issue.id) {
    button.textContent = "Cancel reserved Command Bearing";
    button.disabled = typeof actions.cancelCohesionRelief !== "function";
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      commandError.hidden = true;
      try {
        const result = await actions.cancelCohesionRelief();
        button.textContent = result?.applied
          ? "Command Bearing reservation cancelled"
          : "Command Bearing reservation unavailable";
        if (result?.applied) await actions.refresh?.();
        else button.disabled = false;
      } catch (cause) {
        button.disabled = false;
        showCommandError(cause);
      }
    });
  } else {
    const available = Number(commandBearing?.balance || 0) > 0 && !pending;
    button.textContent = pending
      ? "Command Bearing is reserved for another task"
      : "Spend 1 Command Bearing · resolve +" + literal(reward.cohesion, 0);
    button.disabled = !available || typeof actions.reserveCohesionRelief !== "function";
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      commandError.hidden = true;
      try {
        const result = await actions.reserveCohesionRelief({ issueId: issue.id });
        button.textContent = result?.applied
          ? "Command Bearing relief reserved"
          : "Command Bearing unavailable";
        if (result?.applied) await actions.refresh?.();
        else button.disabled = false;
      } catch (cause) {
        button.disabled = false;
        showCommandError(cause);
      }
    });
  }
  command.append(
    button,
    commandError,
    appendText(
      createElement("p"),
      "A point resolves this visible Cohesion issue after its causal result is accepted; it does not bypass unrelated permanent system evidence.",
    ),
  );
  content.append(command);
  return content;
}

function installCalloutLayout({
  workspace, orbit, visual, leaders, buttons, mobileCallouts, mobileBadges,
  tasks, shipId, visualAnchors,
}) {
  if (typeof orbit?.getBoundingClientRect !== "function" || typeof globalThis.requestAnimationFrame !== "function") return;
  const image = visual.querySelector?.(".directive-media-image");
  if (!image || typeof image.getBoundingClientRect !== "function") {
    leaders.classList.add("is-layout-unavailable");
    return;
  }
  let frame = 0;
  let observer = null;
  const layout = () => {
    frame = 0;
    if (!workspace.isConnected) {
      observer?.disconnect?.();
      return;
    }
    const mobile = globalThis.matchMedia?.("(max-width: 820px)")?.matches === true;
    const orbitRect = mobile ? mobileCallouts.getBoundingClientRect() : orbit.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const controls = mobile ? mobileBadges : buttons;
    const controlSizes = Object.fromEntries(controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return [control.dataset.taskId, { width: rect.width, height: rect.height }];
    }));
    const result = createShipCalloutLayout({
      mode: mobile ? "mobile" : "desktop",
      orbitRect,
      imageRect,
      imageNaturalSize: { width: image.naturalWidth, height: image.naturalHeight },
      anchors: visualAnchors,
      shipId,
      tasks,
      controlSizes,
    });
    leaders.setAttribute("viewBox", `0 0 ${orbitRect.width} ${orbitRect.height}`);
    leaders.dataset.crossingCount = String(result.crossingCount);
    leaders.classList.toggle("is-layout-unavailable", !result.valid);
    for (const placement of result.placements) {
      const button = controls.find(({ dataset }) => dataset.taskId === placement.taskId);
      const leader = [...leaders.children].find(({ dataset }) => dataset.taskId === placement.taskId);
      if (!button || !leader) continue;
      button.style.left = `${placement.controlRect.x}px`;
      button.style.top = `${placement.controlRect.y}px`;
      button.dataset.slot = placement.slotId;
      button.dataset.corner = placement.corner;
      leader.dataset.slot = placement.slotId;
      leader.dataset.corner = placement.corner;
      leader.dataset.anchor = placement.anchor;
      leader.setAttribute("points", placement.points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "));
    }
    workspace.dataset.calloutLayoutReady = result.valid ? "true" : "false";
  };
  const schedule = () => {
    if (frame) return;
    frame = globalThis.requestAnimationFrame(layout);
  };
  if (typeof globalThis.ResizeObserver === "function") {
    observer = new globalThis.ResizeObserver(schedule);
    observer.observe(orbit);
    observer.observe(image);
    observer.observe(mobileCallouts);
  } else {
    globalThis.addEventListener?.("resize", schedule, { passive: true });
  }
  if (!image.complete) {
    image.addEventListener("load", schedule, { once: true });
    image.addEventListener("error", schedule, { once: true });
  }
  schedule();
}

function appendIssueCopy(parent, label, value, extraClass = "") {
  if (!present(value)) return;
  const section = createElement("section", `ship-task-detail-section${extraClass ? ` ${extraClass}` : ""}`);
  section.append(appendText(createElement("h4"), label), appendText(createElement("p"), value));
  parent.append(section);
}

function createReward(reward) {
  const node = appendText(createElement("span", "ship-task-reward"), `+${literal(reward.cohesion, 0)} Cohesion`);
  node.setAttribute("aria-label", `${literal(reward.cohesion, 0)} Cohesion reward, ${literal(reward.segments, 0)} segments`);
  return node;
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
