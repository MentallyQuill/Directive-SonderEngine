import { createDirectiveShell } from "./shell.js";
import { createCampaignDeleteDialog } from "./campaign-delete-dialog.js";
import { renderCampaignBrowser } from "./campaign-library.js";
import { createLoadGameDialog, createSaveGameDialog } from "./timeline-dialogs.js";
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
const OPTIONAL_PLAYER_FIELDS = Object.freeze([
  "service_summary",
  "command_style",
  "brief_biography",
  "public_reputation",
  "portrait_data_url",
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
      state.route = "campaign";
      state.campaign.mode = "command";
      container.replaceChildren();
      const chatId = sonder.state()?.chatId;
      const hasActiveStory = chatId !== undefined && chatId !== null;
      let projection = null;
      let projectionError = null;
      let projectionPending = hasActiveStory;
      const shell = createDirectiveShell({
        activeRouteId: state.route,
        onSelectRoute: (routeId) => {
          state.route = routeId;
          drawRoute();
        },
        onClose,
      });
      const overlay = el("div", {
        id: "directive-runtime-overlay",
        class: "directive-runtime-overlay directive-runtime-overlay-open",
        "aria-hidden": "false",
      });
      const backdrop = el("div", { class: "directive-runtime-backdrop", "aria-hidden": "true" });
      backdrop.addEventListener("click", onClose);
      const panelHost = el("div", { class: "directive-runtime-panel-host" }, shell);
      overlay.append(backdrop, panelHost);
      container.append(overlay);
      const body = shell.querySelector(".directive-route-body");
      drawRoute();
      if (hasActiveStory) {
        try {
          projection = await sonder.api("GET", `/api/extensions/directive/x/projection?chat_id=${encodeURIComponent(chatId)}`);
        } catch (error) {
          projectionError = error;
        } finally {
          projectionPending = false;
          drawRoute();
        }
      }

      function drawRoute() {
        body.replaceChildren();
        if (chatId === undefined || chatId === null) {
          if (state.route === "campaign") {
            if (state.campaign.mode === "creator") {
              const surface = el("section", {
                class: "directive-expanded-campaign directive-creator-route",
                "data-directive-scroll-owner": "true",
              }, renderCreatorView(state.creator, {
                provisionCampaign,
                openCampaign,
                refreshCampaign,
                returnToCampaignLibrary: () => {
                  state.campaign.mode = "command";
                  drawRoute();
                },
                saveCreatorDraft: () => {},
                discardCreatorDraft: () => {
                  state.campaign.mode = "command";
                  drawRoute();
                },
                generateCreatorSectionDraft: ({ sectionId, input }) => sonder.api(
                  "POST",
                  "/api/extensions/directive/x/creator-assist",
                  { section_id: sectionId, input },
                ),
              }));
              body.append(surface);
            } else {
              body.append(renderCampaignBrowser(state.campaign, {
                startCampaign: () => {
                  state.campaign.mode = "creator";
                  drawRoute();
                },
                selectCampaignRecord: (key) => {
                  state.campaign.selectedRecordKey = key;
                  drawRoute();
                },
              }));
            }
          } else {
            body.append(noCampaignRoute(state.route));
          }
          return;
        }
        if (projectionPending) {
          body.append(loadingStory());
          return;
        }
        if (projectionError || !projection) {
          body.append(emptyStory(onClose));
          return;
        }
        body.append(routeView(state.route, projection, state, {
          continueCampaign,
          saveGame,
          loadGame,
          deleteCampaign,
          reserveCommandBearingEdge,
          cancelCommandBearingEdge,
          reserveCohesionRelief,
          cancelCohesionRelief,
          refresh: refreshProjection,
          redraw: drawRoute,
        }));
      }

      async function provisionCampaign(payload) {
        const mode = SIMULATION_MODES.find(({ value }) => value === payload.simulation_mode);
        if (!mode) throw new Error("Unsupported simulation mode");
        const body = Object.fromEntries([
          ...PLAYER_FIELDS.map(([name]) => [name, payload[name]]),
          ...OPTIONAL_PLAYER_FIELDS
            .filter((name) => typeof payload[name] === "string" && payload[name])
            .map((name) => [name, payload[name]]),
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

      function saveGame(data, opener) {
        createSaveGameDialog({
          campaign: { chapter: data.mission?.title || data.mission?.id },
          opener,
          onSave: ({ name }) => cloneTimeline(data, name),
          onSaved: async () => {
            projection = await readProjection(chatId);
            drawRoute();
          },
        });
      }

      function loadGame(data, opener) {
        createLoadGameDialog({
          campaign: { savedGames: data.saved_games || [] },
          opener,
          onLoad: async ({ savedGameId }) => {
            const selected = (data.saved_games || []).find((item) => item.id === savedGameId);
            if (!selected) throw new Error("The selected saved game is no longer available.");
            const archive = await sonder.api("GET", `/api/chats/${encodeURIComponent(selected.chat_id)}/export`);
            const copy = structuredClone(archive);
            copy.chat = { ...(copy.chat || {}), name: data.campaign?.title || "Ashes of Peace" };
            const made = await sonder.api("POST", "/api/chats/import", { data: copy });
            const loadedId = made?.id ?? made?.chat_id;
            if (loadedId === undefined || loadedId === null) throw new Error("Loaded timeline returned no story id.");
            const previous = timelineRecord(data, data.chat_id, "Previous timeline");
            try {
              await sonder.api("POST", `/api/extensions/directive/x/saves?chat_id=${encodeURIComponent(loadedId)}`, previous);
            } catch (cause) {
              try { await sonder.api("DELETE", `/api/chats/${encodeURIComponent(loadedId)}`); } catch {}
              throw cause;
            }
            await sonder.chats.open(loadedId);
            onClose();
          },
          onDelete: async ({ savedGameId }) => {
            const selected = (projection?.saved_games || data.saved_games || []).find((item) => item.id === savedGameId);
            if (!selected) throw new Error("The selected saved game is no longer available.");
            const unregisterUrl = `/api/extensions/directive/x/saves?chat_id=${encodeURIComponent(chatId)}&saved_game_id=${encodeURIComponent(savedGameId)}`;
            const result = await sonder.api("DELETE", unregisterUrl);
            try {
              await sonder.api("DELETE", `/api/chats/${encodeURIComponent(selected.chat_id)}`);
            } catch (cause) {
              const restored = await sonder.api("POST", `/api/extensions/directive/x/saves?chat_id=${encodeURIComponent(chatId)}`, selected);
              if (projection) projection.saved_games = restored?.saved_games || [...(projection.saved_games || []), selected];
              throw cause;
            }
            if (projection) projection.saved_games = result?.saved_games || [];
          },
        });
      }

      function deleteCampaign(data, opener) {
        createCampaignDeleteDialog({
          campaign: {
            id: data.chat_id,
            title: data.campaign?.title || "Ashes of Peace",
            savedGames: data.saved_games || [],
          },
          opener,
          onDelete: async () => {
            const savedChatIds = [...new Set((data.saved_games || []).map((item) => item.chat_id))]
              .filter((id) => id !== undefined && id !== null && Number(id) !== Number(data.chat_id));
            for (const savedChatId of savedChatIds) {
              await deleteStoryIfPresent(sonder, savedChatId);
            }
            await deleteStoryIfPresent(sonder, data.chat_id);
            onClose();
            await sonder.refresh?.();
          },
        });
      }

      async function cloneTimeline(data, name) {
        const archive = await sonder.api("GET", `/api/chats/${encodeURIComponent(data.chat_id)}/export`);
        const copy = structuredClone(archive);
        copy.chat = { ...(copy.chat || {}), name: `${data.campaign?.title || "Ashes of Peace"} — ${name}` };
        const made = await sonder.api("POST", "/api/chats/import", { data: copy });
        const savedChatId = made?.id ?? made?.chat_id;
        if (savedChatId === undefined || savedChatId === null) throw new Error("Saved timeline returned no story id.");
        const record = timelineRecord(data, savedChatId, name);
        let result;
        try {
          result = await sonder.api("POST", `/api/extensions/directive/x/saves?chat_id=${encodeURIComponent(data.chat_id)}`, record);
        } catch (cause) {
          try { await deleteStoryIfPresent(sonder, savedChatId); } catch {}
          throw cause;
        }
        if (projection) projection.saved_games = result?.saved_games || [...(projection.saved_games || []), record];
        return record;
      }

      function readProjection(activeChatId) {
        return sonder.api("GET", `/api/extensions/directive/x/projection?chat_id=${encodeURIComponent(activeChatId)}`);
      }

      function reserveCommandBearingEdge() {
        return sonder.api("POST", `/api/extensions/directive/x/command-bearing/edge?chat_id=${encodeURIComponent(chatId)}`, {});
      }

      function cancelCommandBearingEdge() {
        return sonder.api("DELETE", `/api/extensions/directive/x/command-bearing/edge?chat_id=${encodeURIComponent(chatId)}`, {});
      }

      function reserveCohesionRelief({ issueId }) {
        return sonder.api(
          "POST",
          `/api/extensions/directive/x/command-bearing/cohesion?chat_id=${encodeURIComponent(chatId)}`,
          { issue_id: issueId },
        );
      }

      function cancelCohesionRelief() {
        return sonder.api("DELETE", `/api/extensions/directive/x/command-bearing/cohesion?chat_id=${encodeURIComponent(chatId)}`);
      }

      async function refreshProjection() {
        projection = await readProjection(chatId);
        drawRoute();
      }
    }
  };
}

async function deleteStoryIfPresent(sonder, storyId) {
  try {
    return await sonder.api("DELETE", `/api/chats/${encodeURIComponent(storyId)}`);
  } catch (cause) {
    const status = Number(cause?.status ?? cause?.statusCode ?? cause?.response?.status);
    const message = String(cause?.message || cause || "");
    if (status === 404 || /\b(?:not found|does not exist|already deleted)\b/i.test(message)) {
      return { ok: true, already_absent: true };
    }
    throw cause;
  }
}

function timelineRecord(data, savedChatId, name) {
  return {
    id: `save-${savedChatId}`,
    chat_id: savedChatId,
    name,
    createdAt: new Date().toISOString(),
    chapter: data.mission?.title || data.mission?.id || "",
    stardate: data.time?.stardate,
  };
}

function loadingStory() {
  const status = el("section", { class: "directive-empty", role: "status", "aria-live": "polite" },
    el("p", { class: "directive-kicker" }, "DIRECTIVE CAMPAIGN"),
    el("h1", {}, "Opening campaign record"),
    el("p", {}, "Loading the player-safe campaign projection."));
  return status;
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
  if (route === "ship") return renderShipView(data, actions);
  if (route === "people") return renderPeopleView(data, state.people, actions);
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
