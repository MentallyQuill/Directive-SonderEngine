import { DIRECTIVE_CAMPAIGN_LIBRARY, renderCampaignBrowser } from "../campaign-library.js";
import { createCampaignHeroScene } from "../hero-scene.js";
import { appendText, createElement } from "../primitives.js";
import { bindReactiveHeroOrbit } from "../reactive-hero-orbit.js";

const DELETE_CAMPAIGN_ICON = "/api/extensions/directive/asset/assets/icons/delete-campaign.svg";

export function renderCampaignView(data = {}, state = {}, actions = {}) {
  if (state.mode === "browser") {
    return renderCampaignBrowser(state, {
      ...actions,
      showCurrentCampaign: () => {
        state.mode = "command";
        actions.redraw?.();
      },
      selectCampaignRecord: (key) => {
        state.selectedRecordKey = key;
        actions.redraw?.();
      },
    }, activeCampaign(data));
  }

  state.mode = "command";
  const dashboard = createElement("section", "directive-expanded-campaign campaign-layout campaign-dashboard");
  dashboard.dataset.campaignView = "dashboard";
  dashboard.dataset.directiveScrollOwner = "true";

  const heading = createElement("header", "campaign-dashboard-heading");
  const campaigns = createButton("Campaigns", "campaign-command campaign-browser-command", () => {
    state.mode = "browser";
    state.selectedRecordKey = `campaign:${data.campaign?.id || data.chat_id}`;
    actions.redraw?.();
  });
  campaigns.dataset.campaignAction = "campaigns";
  heading.append(appendText(createElement("h2"), "Current Campaign"), campaigns);
  dashboard.append(heading, createCampaignHero(data), createCampaignActions(data, actions));
  return dashboard;
}

function activeCampaign(data) {
  return {
    id: data.campaign?.id || data.chat_id,
    chat_id: data.chat_id,
    title: literal(data.campaign?.title, "Campaign title unavailable."),
    playerName: literal(data.player?.name, literal(data.viewer?.name, "Player identity unavailable.")),
    playerRole: literal(data.player?.billet, "Player role unavailable."),
    setting: literal(data.ship?.name, "Campaign setting unavailable."),
    chapter: literal(data.mission?.title, literal(data.mission?.id, "Current mission unavailable.")),
    premise: literal(data.campaign?.summary, literal(data.mission?.summary, literal(data.mission?.id, "Campaign summary unavailable."))),
    image: DIRECTIVE_CAMPAIGN_LIBRARY[0].image,
  };
}

function createCampaignActions(data, actions) {
  const commands = createElement("div", "campaign-detail-actions campaign-dashboard-actions");
  const continueCampaign = createButton("Continue", "campaign-command campaign-command-primary", () => actions.continueCampaign?.(data.chat_id), "fa-solid fa-arrow-right");
  continueCampaign.dataset.campaignAction = "continue";
  continueCampaign.disabled = typeof actions.continueCampaign !== "function";

  const saveGame = createButton("Save Game", "campaign-command", (event) => actions.saveGame?.(data, event.currentTarget), "fa-solid fa-bookmark");
  saveGame.dataset.campaignAction = "save";
  saveGame.disabled = typeof actions.saveGame !== "function";

  const loadGame = createButton("Load Game", "campaign-command", (event) => actions.loadGame?.(data, event.currentTarget), "fa-solid fa-clock-rotate-left");
  loadGame.dataset.campaignAction = "load";
  loadGame.disabled = typeof actions.loadGame !== "function";

  const deleteCampaign = createElement("button", "campaign-command campaign-command-danger campaign-delete-command campaign-delete-icon-command");
  deleteCampaign.type = "button";
  deleteCampaign.dataset.campaignAction = "delete";
  deleteCampaign.setAttribute("aria-label", "Delete campaign");
  deleteCampaign.title = "Delete campaign";
  deleteCampaign.disabled = typeof actions.deleteCampaign !== "function";
  const icon = createElement("span", "directive-asset-mask-icon campaign-delete-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.dataset.assetIcon = "assets/icons/delete-campaign.svg";
  icon.style.setProperty("--directive-asset-mask-url", `url("${DELETE_CAMPAIGN_ICON}")`);
  deleteCampaign.append(icon);
  deleteCampaign.addEventListener("click", (event) => actions.deleteCampaign?.(data, event.currentTarget));

  commands.append(continueCampaign, saveGame, loadGame, deleteCampaign);
  return commands;
}

function createButton(label, className, onClick, iconClass = "") {
  const button = createElement("button", className);
  button.type = "button";
  if (iconClass) {
    const icon = createElement("i", iconClass);
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
  }
  button.append(appendText(createElement("span"), label));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick?.(event);
  });
  return button;
}

function createCampaignHero(data) {
  const hero = createElement("section", "campaign-hero campaign-dashboard-hero");
  hero.append(createCampaignMedia(data, "hero", "campaign-hero-media directive-media-frame"));

  const copy = createElement("div", "campaign-hero-copy");
  copy.append(
    appendText(createElement("span", "campaign-status"), "Current campaign"),
    appendText(createElement("h2"), literal(data.campaign?.title, "Campaign title unavailable.")),
    appendText(createElement("p"), [
      literal(data.player?.name, literal(data.viewer?.name, "Player identity unavailable.")),
      literal(data.player?.billet, "Player role unavailable."),
      literal(data.ship?.name, "Campaign setting unavailable."),
    ].join(" / ")),
    appendText(createElement("p", "campaign-summary"), campaignPremise(data)),
  );
  const chronometer = createChronometer(data.time);
  if (chronometer) copy.append(chronometer);
  hero.append(copy);
  bindReactiveHeroOrbit(hero);
  return hero;
}

function createCampaignMedia(data, variant, className) {
  const fallbackMedia = DIRECTIVE_CAMPAIGN_LIBRARY[0].image;
  const media = data.media?.ship || fallbackMedia;
  const scene = variant === "hero" ? (media.scene || fallbackMedia.scene) : null;
  if (scene?.layers?.background && scene?.layers?.stars && scene?.layers?.foreground) {
    return createCampaignHeroScene({ ...fallbackMedia, ...media, scene }, className);
  }
  const frame = createElement("figure", className);
  const placeholder = appendText(createElement("span", "directive-media-placeholder"), "Campaign media unavailable.");
  const source = clean(data.media?.ship?.variants?.[variant]) || (variant === "card" ? clean(data.media?.ship?.variants?.hero) : "");
  placeholder.hidden = Boolean(source);
  if (source) {
    const image = createElement("img", "directive-media-image");
    image.src = source;
    image.alt = clean(data.media?.ship?.alt);
    image.addEventListener("error", () => {
      image.hidden = true;
      placeholder.hidden = false;
    });
    frame.append(image);
  }
  frame.append(placeholder);
  return frame;
}

function createChronometer(time = {}) {
  if (!present(time.clock_display) && !present(time.stardate_display) && !present(time.stardate)) return null;
  const root = createElement("section", "directive-ship-chronometer directive-ship-chronometer-campaign");
  root.setAttribute("aria-label", "Current accepted ship time");
  root.append(
    appendText(createElement("span", "directive-ship-chronometer-label"), "Ship time"),
    appendText(createElement("strong", "directive-ship-chronometer-clock"), literal(time.clock_display, "Unavailable")),
    appendText(createElement("span", "directive-ship-chronometer-stardate"), `Stardate ${literal(time.stardate_display, literal(time.stardate, "unavailable"))}`),
  );
  return root;
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function campaignPremise(data = {}) {
  const campaign = data.campaign || {};
  if (present(campaign.premise)) return String(campaign.premise);
  if (present(campaign.chapter)) return String(campaign.chapter);
  if (present(data.mission?.id)) return String(data.mission.id).replace(/^mission\./, "");
  return "Current mission unavailable.";
}

function literal(value, empty) {
  return clean(value) || empty;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
}
