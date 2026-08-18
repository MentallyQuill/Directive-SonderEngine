import { createDirectiveShell } from "./shell.js";
import { renderCampaignView } from "./views/campaign.js";
import { renderCreatorView } from "./views/creator.js";

const PLAYER_FIELDS = Object.freeze([
  ["name"],
  ["pronouns_or_address"],
  ["species"],
  ["age_band"],
  ["appearance"],
  ["career_background"],
  ["formative_experience"],
  ["assignment_reason"],
  ["insight_trait"],
  ["connection_trait"],
  ["execution_trait"],
  ["flaw"],
]);
const SIMULATION_MODES = Object.freeze([
  Object.freeze({ name: "simulation_mode", value: "Command" }),
  Object.freeze({ name: "simulation_mode", value: "Exploration" }),
]);

export function createDirectiveView(sonder, { onClose = () => sonder.closeView() } = {}) {
  const state = {
    route: "campaign",
    campaign: { mode: "command" },
    creator: { step: "identity", input: {}, status: "" },
  };
  return {
    id: "directive",
    label: "Directive",
    async render(container) {
      container.replaceChildren();
      const chatId = sonder.state()?.chatId;
      let projection = null;
      let projectionError = null;
      if (chatId !== undefined && chatId !== null) {
        try {
          projection = await sonder.api("GET", `/api/extensions/directive/x/projection?chat_id=${encodeURIComponent(chatId)}`);
        } catch (error) {
          projectionError = error;
        }
      }
      const shell = createDirectiveShell({
        activeRouteId: state.route,
        onSelectRoute: (routeId) => {
          state.route = routeId;
          drawRoute();
        },
        onClose,
        time: projection?.time,
      });
      container.append(shell);
      const body = shell.querySelector(".directive-route-body");
      drawRoute();

      function drawRoute() {
        body.replaceChildren();
        if (chatId === undefined || chatId === null) {
          body.append(state.route === "campaign"
            ? renderCreatorView(state.creator, { provisionCampaign, openCampaign, refreshCampaign })
            : noCampaignRoute(state.route));
          return;
        }
        if (projectionError || !projection) {
          body.append(emptyStory(onClose));
          return;
        }
        body.append(routeView(state.route, projection, state, { continueCampaign }));
      }

      async function provisionCampaign(payload) {
        const mode = SIMULATION_MODES.find(({ value }) => value === payload.simulation_mode);
        if (!mode) throw new Error("Unsupported simulation mode");
        const body = Object.fromEntries([
          ...PLAYER_FIELDS.map(([name]) => [name, payload[name]]),
          [mode.name, mode.value],
        ]);
        const made = await sonder.api("POST", "/api/extensions/directive/x/start", body);
        if (made?.chat_id === undefined || made?.chat_id === null) throw new Error("Campaign start returned no chat id");
        return made.chat_id;
      }

      async function openCampaign(createdChatId) {
        await sonder.chats.open(createdChatId);
      }

      async function refreshCampaign() {
        await sonder.refresh();
      }

      async function continueCampaign(activeChatId) {
        await sonder.chats.open(activeChatId);
        onClose();
      }
    }
  };
}

function emptyStory(onClose) {
  return el("section", { class: "directive-empty" },
    el("p", { class: "directive-kicker" }, "NO DIRECTIVE CAMPAIGN HERE"),
    el("h1", {}, "This story belongs to Sonder"),
    el("p", {}, "Directive only opens campaign state it provisioned. Return to Stories to create or open Ashes of Peace."),
    el("button", { class: "directive-primary", onclick: onClose }, "Return to story"));
}

function routeView(route, data, state, actions) {
  if (route === "mission") return missionView(data);
  if (route === "ship") return shipView(data.ship);
  if (route === "people") return peopleView(data.people, false);
  if (route === "settings") return settingsView(data);
  return renderCampaignView(data, state.campaign, actions);
}

function noCampaignRoute(route) {
  return el("section", { class: "directive-empty" },
    el("p", { class: "directive-kicker" }, String(route || "Directive").toUpperCase()),
    el("h1", {}, "No active Directive campaign"),
    el("p", {}, "Use Campaign to commission an officer and start Ashes of Peace."));
}

function settingsView(data) {
  return el("section", { class: "directive-view" },
    sectionHead("SETTINGS", "Directive campaign settings", data.campaign?.simulation_mode || "Simulation mode unavailable."));
}

function missionView(data) {
  const mission = data.mission || {};
  return el("section", { class: "directive-view" },
    sectionHead("MISSION", titleCase(String(mission.id || "Current mission").replace(/^mission\./, "").replaceAll("-", " ")), `Revision ${mission.revision ?? 0} · ${titleCase(mission.status || "active")}`),
    el("div", { class: "directive-card-grid" }, ...(mission.objectives || []).map(objective =>
      el("article", { class: `directive-card directive-objective is-${String(objective.state || "inactive").toLowerCase()}` },
        el("span", { class: "directive-card__status" }, titleCase(objective.state || "inactive")),
        objective.title ? el("h2", {}, text(objective.title)) : fragment(),
        objective.summary ? el("p", {}, text(objective.summary)) : fragment(),
        objective.terminal_text ? el("p", { class: "directive-result" }, text(objective.terminal_text)) : fragment()))),
    Object.keys(mission.outcome_dimensions || {}).length ? panel("Outcome record", definitionList(mission.outcome_dimensions)) : fragment());
}

function shipView(ship) {
  const cohesion = ship?.cohesion || {};
  return el("section", { class: "directive-view" },
    sectionHead("U.S.S. BRECKENRIDGE", "Operational readiness", `${cohesion.band?.label || ""} · ${cohesion.total ?? ""} Cohesion`),
    el("div", { class: "directive-segments", role: "img", "aria-label": `${cohesion.total ?? 0} cohesion` },
      ...(cohesion.segments || []).map(segment => el("span", { class: `directive-segment${segment.filled ? " is-filled" : " is-open"}`, title: segment.issueId || "Ready" }))),
    el("div", { class: "directive-card-grid" }, ...(ship?.systems || []).map(system =>
      el("article", { class: "directive-card directive-system" },
        el("span", { class: "directive-card__status" }, system.state?.label || ""),
        el("h2", {}, text(system.label || "Ship system")),
        system.state?.mechanicalEffect ? el("p", {}, text(system.state.mechanicalEffect)) : fragment(),
        el("h3", {}, "Work orders"),
        el("ul", { class: "directive-work" }, ...((system.work_orders || []).filter(order => order.status !== "unknown").map(order =>
          el("li", { class: `is-${order.status}` }, el("strong", {}, text(order.label || "Work order")), order.summary ? el("span", {}, text(order.summary)) : fragment()))))))),
    (cohesion.issues || []).length ? panel("Cohesion priorities", el("div", { class: "directive-issue-list" }, ...cohesion.issues.map(issue =>
      el("article", { class: "directive-issue" }, el("span", {}, `LEVEL ${issue.level}`), el("h3", {}, text(issue.player_text?.title || "Operational issue")),
        issue.player_text?.situation ? el("p", {}, text(issue.player_text.situation)) : fragment())))) : fragment());
}

function peopleView(people, crewOnly) {
  const filtered = (people || []).filter(person => !crewOnly || person.directive);
  return el("section", { class: "directive-view" },
    sectionHead(crewOnly ? "SENIOR STAFF" : "PEOPLE", crewOnly ? "Crew manifest" : "Observed people", `${filtered.length} ${crewOnly ? "officers" : "records"}`),
    el("div", { class: "directive-card-grid" }, ...filtered.map(person => {
      const domain = person.directive || {};
      return el("article", { class: "directive-card directive-person" },
        domain.media?.variants?.card ? el("img", { class: "directive-person__portrait", src: domain.media.variants.card, alt: domain.media.alt || "" }) : fragment(),
        el("span", { class: "directive-card__status" }, text(domain.rank || titleCase(person.identity_status || "observed"))),
        el("h2", { translate: "no" }, text(person.display_name || "Observed person")),
        domain.role ? el("p", { class: "directive-person__role" }, text(domain.role)) : fragment(),
        domain.operational_summary ? el("p", {}, text(domain.operational_summary)) : fragment(),
        domain.department ? el("span", { class: "directive-tag" }, text(domain.department)) : fragment());
    })));
}

function sectionHead(kicker, title, meta) {
  return el("header", { class: "directive-section-head" }, el("p", { class: "directive-kicker" }, kicker), el("h1", {}, title), el("p", { class: "directive-section-meta" }, meta));
}
function panel(title, body) { return el("section", { class: "directive-panel" }, el("h2", {}, title), body); }
function definitionList(value) {
  return el("dl", { class: "directive-definitions" }, ...Object.entries(value).flatMap(([key, item]) => [
    el("dt", {}, titleCase(key.replace(/^dimension\.[^.]+\./, "").replaceAll("-", " "))), el("dd", { translate: "no" }, text(String(item)))
  ]));
}
function titleCase(value) { return String(value).replace(/\b\w/g, letter => letter.toUpperCase()); }
function fragment() { return document.createDocumentFragment(); }
function text(value) { return document.createTextNode(String(value ?? "")); }

function el(tag, attrs = {}, ...children) {
  const value = document.createElement(tag);
  for (const [key, item] of Object.entries(attrs)) {
    if (item === null || item === undefined || item === false) continue;
    if (key === "class") value.className = item;
    else if (key.startsWith("on") && typeof item === "function") value.addEventListener(key.slice(2), item);
    else if (item === true) value.setAttribute(key, "");
    else value.setAttribute(key, String(item));
  }
  value.append(...children.filter(Boolean).map(child => typeof child === "string" ? document.createTextNode(child) : child));
  return value;
}
