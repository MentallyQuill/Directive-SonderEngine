import { createDirectiveShell } from "./shell.js";
import { renderCampaignView } from "./views/campaign.js";
import { renderCreatorView } from "./views/creator.js";
import { renderMissionView } from "./views/mission.js";
import { renderPeopleView } from "./views/people.js";
import { renderSettingsView } from "./views/settings.js";
import { renderShipView } from "./views/ship.js";

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
    people: { selectedPersonId: null },
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
  if (route === "mission") return renderMissionView(data);
  if (route === "ship") return renderShipView(data);
  if (route === "people") return renderPeopleView(data, state.people);
  if (route === "settings") return renderSettingsView(data);
  return renderCampaignView(data, state.campaign, actions);
}

function noCampaignRoute(route) {
  return el("section", { class: "directive-empty" },
    el("p", { class: "directive-kicker" }, String(route || "Directive").toUpperCase()),
    el("h1", {}, "No active Directive campaign"),
    el("p", {}, "Use Campaign to commission an officer and start Ashes of Peace."));
}

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
